"""RAG helper functions with hybrid GPT-4o conversation system."""
from __future__ import annotations
import os
from pathlib import Path
from typing import List, Optional, Tuple, Dict, Any
import openai
from chromadb import PersistentClient
from llama_index.core import Settings, VectorStoreIndex
from llama_index.embeddings.openai import OpenAIEmbedding
from llama_index.llms.openai import OpenAI
from llama_index.vector_stores.chroma import ChromaVectorStore
from dotenv import load_dotenv
load_dotenv(override=True)
# --------------------------------------------------------------------------- #
# Configuration
# --------------------------------------------------------------------------- #
openai_client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
SIM_THRESHOLD: float = 0.30  # minimum similarity to use RAG knowledge

INDEX_DIR = (
    Path(__file__)
    .resolve()
    .parent.parent  # → backend/app/
    / "../rag/chroma_db"  # backend/rag/chroma_db
).resolve()

# --------------------------------------------------------------------------- #
# Initialise Chroma-powered query engine (loads once per worker)
# --------------------------------------------------------------------------- #
chroma_client = PersistentClient(path=str(INDEX_DIR))
collection = chroma_client.get_or_create_collection("nhs_docs")
store = ChromaVectorStore(chroma_collection=collection, stores_text=True)

Settings.embed_model = OpenAIEmbedding(model="text-embedding-3-small")
Settings.llm = OpenAI(model="gpt-4o-mini", temperature=0.2)  # Keep for RAG retrieval

index = VectorStoreIndex.from_vector_store(store)
query_engine = index.as_query_engine(similarity_top_k=4)

# --------------------------------------------------------------------------- #
# Medical question classifier
# --------------------------------------------------------------------------- #
MEDICAL_CLASSIFIER_PROMPT = """
You are a classifier that determines if a question is medical/health-related or general conversation.

Return only "MEDICAL" or "GENERAL".

Examples:
"Hello" -> GENERAL
"How are you?" -> GENERAL  
"What's the weather like?" -> GENERAL
"Tell me a joke" -> GENERAL
"What is diabetes?" -> MEDICAL
"I have a headache, what should I do?" -> MEDICAL
"How to treat high blood pressure?" -> MEDICAL
"What are the symptoms of flu?" -> MEDICAL
"My medication side effects" -> MEDICAL
"Cancer treatment options" -> MEDICAL

Question: "{question}"
Classification:"""

def is_medical_question(question: str) -> bool:
    """Classify if a question is medical/health-related using GPT-4o"""
    try:
        response = openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "user", "content": MEDICAL_CLASSIFIER_PROMPT.format(question=question)}
            ],
            max_tokens=10,
            temperature=0
        )
        
        classification = response.choices[0].message.content.strip().upper()
        return classification == "MEDICAL"
    except Exception as e:
        print(f"[DEBUG] Classification error: {e}")
        # Default to medical if classifier fails - safer approach
        return True

# --------------------------------------------------------------------------- #
# RAG retrieval function
# --------------------------------------------------------------------------- #
# --------------------------------------------------------------------------- #
# RAG retrieval function with exponential weighting
# --------------------------------------------------------------------------- #
def get_rag_context_weighted(
    current_query: str, 
    conversation_history: Optional[List[Dict[str, str]]] = None,
    primary_weight: float = 0.8,
    context_weight: float = 0.2
) -> Tuple[Optional[str], float, List[str]]:
    """
    Get RAG context using exponentially weighted queries.
    Prioritizes the current question while considering recent context.
    
    Args:
        current_query: The current user question
        conversation_history: Recent conversation messages
        primary_weight: Weight for current query (0.8 = 80% focus on current question)
        context_weight: Weight for context query (0.2 = 20% focus on context)
    
    Returns:
        (context_text | None, similarity_score, sources)
    """
    print(f"[DEBUG] RAG: Using weighted approach - primary: {primary_weight}, context: {context_weight}")
    
    # Always search with current query first (primary search)
    try:
        primary_res = query_engine.query(current_query)
        print(f"[DEBUG] RAG: Primary search (current query only)")
    except Exception as exc:
        print(f"[DEBUG] RAG retrieval error: {exc}")
        return None, 0.0, []
    
    # If nothing retrieved from primary search
    if not primary_res.source_nodes:
        print(f"[DEBUG] RAG: No results from primary search")
        return None, 0.0, []
    
    primary_score = primary_res.source_nodes[0].score or 0.0
    print(f"[DEBUG] RAG: Primary similarity '{current_query[:30]}…' = {primary_score:.3f}")
    
    # Build contextual query only if we have conversation history
    contextual_score = 0.0
    if conversation_history and len(conversation_history) > 0:
        try:
            # Build lightweight contextual query (last 2 messages max)
            recent_context = []
            for msg in conversation_history[-2:]:  # Only last 2 messages for context
                recent_context.append(f"{msg['role']}: {msg['content']}")
            
            contextual_query = f"Context: {' | '.join(recent_context)} | Current: {current_query}"
            print(f"[DEBUG] RAG: Contextual search with recent history")
            
            context_res = query_engine.query(contextual_query)
            if context_res.source_nodes:
                contextual_score = context_res.source_nodes[0].score or 0.0
                print(f"[DEBUG] RAG: Contextual similarity = {contextual_score:.3f}")
        except Exception as exc:
            print(f"[DEBUG] RAG: Contextual search failed: {exc}")
            contextual_score = 0.0
    
    # Calculate weighted similarity score
    # This heavily favors the current question but considers context
    final_score = (primary_weight * primary_score) + (context_weight * contextual_score)
    print(f"[DEBUG] RAG: Weighted similarity = {final_score:.3f} (primary: {primary_score:.3f}, context: {contextual_score:.3f})")
    
    # Use primary search results for retrieval (current question focused)
    links: List[str] = [
        n.node.metadata.get("source", "")
        for n in primary_res.source_nodes
        if n.node.metadata.get("source")
    ]
    
    # Domain filter: only NHS / Cancer Research pages
    if not any(("nhs.uk" in url) or ("cancerresearchuk.org" in url) for url in links):
        print(f"[DEBUG] RAG: No NHS/Cancer Research sources found")
        return None, 0.0, links
    
    # Check if weighted similarity is high enough
    if final_score < SIM_THRESHOLD:
        print(f"[DEBUG] RAG: Weighted similarity {final_score:.3f} below threshold {SIM_THRESHOLD}")
        return None, final_score, links
    
    # Extract context from primary search results (focused on current question)
    context_parts = []
    for node in primary_res.source_nodes:
        if node.score and node.score >= (SIM_THRESHOLD * 0.8):  # Slightly lower threshold for individual nodes
            context_parts.append(node.node.text)
    
    context_text = "\n\n".join(context_parts) if context_parts else None
    return context_text, final_score, links

def get_rag_context(query: str) -> Tuple[Optional[str], float, List[str]]:
    """
    Legacy function - now just calls the weighted version with current query only
    """
    # For backwards compatibility, extract just the current question if it's a contextual query
    if "Current question:" in query:
        # Extract just the current question part
        parts = query.split("Current question:")
        if len(parts) > 1:
            current_query = parts[-1].strip()
        else:
            current_query = query
    else:
        current_query = query
    
    return get_rag_context_weighted(current_query)

# --------------------------------------------------------------------------- #
# GPT-4o conversation with optional RAG enhancement
# --------------------------------------------------------------------------- #
def generate_response_with_gpt4o(
    messages: List[Dict[str, str]], 
    current_message: str,
    rag_context: Optional[str] = None,
    sources: Optional[List[str]] = None,
    is_medical: bool = False
) -> str:
    """
    Generate response using GPT-4o, optionally enhanced with RAG context
    """
    
    # Build system prompt
    system_prompt = """You are Kyra, a helpful health assistant. You provide accurate, helpful information while being conversational and friendly.

IMPORTANT: Always pay close attention to the conversation history. If someone asks a follow-up question like "Should I be worried?" or "Is this serious?", look at the previous messages to understand what they're referring to.

For general conversation, respond naturally and warmly.

For medical questions:
- Provide accurate, evidence-based information
- Always recommend consulting healthcare professionals for specific medical concerns
- Be clear about limitations of general medical information
- Use the conversation context to understand what the user is asking about
- If it's a follow-up question, reference the previous topic appropriately"""

    if rag_context:
        system_prompt += f"""

You have access to the following verified medical information from NHS and Cancer Research UK sources:

{rag_context}

Use this information to enhance your response, but don't rely on it exclusively. Combine it with your general knowledge while being clear about the source of specific information."""

    elif is_medical:
        system_prompt += """

For this medical question, you don't have access to specific NHS documents, so provide your general medical knowledge. IMPORTANT: At the end of your response, please include a "Sources:" section with 2-3 reputable medical sources (like NHS.uk, Mayo Clinic, WebMD, or other well-known medical organizations) that would be good references for this topic. Format them as:

Sources:
- NHS.uk - [Topic Name]
- Mayo Clinic - [Topic Name] 
- [Other relevant medical source]

Make sure the sources are real and relevant to the specific medical topic discussed."""

    # Prepare messages for GPT-4o - include conversation history + current message
    gpt_messages = [{"role": "system", "content": system_prompt}]
    gpt_messages.extend(messages)  # Add conversation history
    gpt_messages.append({"role": "user", "content": current_message})  # Add current message
    
    print(f"[DEBUG] Sending {len(gpt_messages)} messages to GPT-4o")
    print(f"[DEBUG] Full conversation context being sent:")
    for i, msg in enumerate(gpt_messages):
        print(f"  {i}. {msg['role']}: {msg['content'][:150]}...")
    
    try:
        response = openai_client.chat.completions.create(
            model="gpt-4o",
            messages=gpt_messages,
            temperature=0.7,  # Slightly more conversational
            max_tokens=1200  # Increased for sources
        )
        
        return response.choices[0].message.content
    except Exception as e:
        print(f"[DEBUG] GPT-4o error: {e}")
        return "I'm having trouble responding right now. Please try again in a moment."

# --------------------------------------------------------------------------- #
# Response formatting with sources
# --------------------------------------------------------------------------- #
def format_response_with_sources(
    response: str, 
    sources: List[str], 
    metadata: Dict[str, Any]
) -> Tuple[str, List[str]]:
    """
    Format the response with appropriate source information
    """
    if not metadata.get("is_medical", False):
        # Non-medical questions don't need source formatting
        return response, sources
    
    if metadata.get("used_rag", False) and sources:
        # RAG was used - format with NHS/Cancer Research sources
        unique_sources = list(dict.fromkeys(sources))  # Remove duplicates while preserving order
        formatted_sources = []
        for source in unique_sources:
            if "nhs.uk" in source.lower():
                formatted_sources.append(f"NHS.uk - {source}")
            elif "cancerresearchuk.org" in source.lower():
                formatted_sources.append(f"Cancer Research UK - {source}")
            else:
                formatted_sources.append(source)
        
        # Add source section to response
        if formatted_sources:
            response += f"\n\n**Sources (Kyra's Knowledge Base):**\n"
            for source in formatted_sources:
                response += f"- {source}\n"
        
        return response, unique_sources
    else:
        # No RAG used - GPT-4o should have included general sources
        gpt_sources = []
        
        # Try to extract sources from GPT-4o response
        if "Sources:" in response or "sources:" in response.lower():
            lines = response.split('\n')
            in_sources = False
            for line in lines:
                line = line.strip()
                if line.lower().startswith('sources:'):
                    in_sources = True
                    continue
                if in_sources and line.startswith('-'):
                    source_text = line[1:].strip()
                    gpt_sources.append(source_text)
                elif in_sources and line and not line.startswith('-'):
                    break
        
        # Remove duplicates from GPT-4o sources
        unique_gpt_sources = list(dict.fromkeys(gpt_sources)) if gpt_sources else []
        
        # Add clear attribution for GPT-4o responses
        if unique_gpt_sources:
            # Replace the Sources section with clearer attribution
            response = response.replace("Sources:", "**Sources (General Medical Knowledge - GPT-4o):**")
        else:
            response += f"\n\n**Note:** This response is based on general medical knowledge (GPT-4o AI), not our internal knowledge base. For official NHS guidance, please visit NHS.uk or consult your healthcare provider."
        
        return response, unique_gpt_sources if unique_gpt_sources else sources

# --------------------------------------------------------------------------- #
# Main answer function
# --------------------------------------------------------------------------- #
def answer(
    query: str, 
    conversation_history: Optional[List[Dict[str, str]]] = None,
    original_query: Optional[str] = None
) -> Tuple[str, List[str], Dict[str, Any]]:
    """
    Main answer function that handles both general and medical questions.
    
    Args:
        query: Current user question (may include context)
        conversation_history: List of {"role": "user/assistant", "content": "..."}
        original_query: Original query without conversation context
    
    Returns:
        (response_text, sources, metadata)
    """
    
    print(f"[DEBUG] === ANSWER FUNCTION CALLED ===")
    print(f"[DEBUG] Query: {query[:200]}...")
    print(f"[DEBUG] Original query: {original_query}")
    print(f"[DEBUG] Conversation history length: {len(conversation_history) if conversation_history else 0}")
    
    if conversation_history:
        print(f"[DEBUG] Conversation history:")
        for i, msg in enumerate(conversation_history):
            print(f"  {i+1}. {msg['role']}: {msg['content'][:100]}...")
    
    # Use original query for classification if available, otherwise use full query
    classify_query = original_query if original_query else query
    current_message = original_query if original_query else query
    
    # Determine if this is a medical question
    is_medical = is_medical_question(classify_query)
    print(f"[DEBUG] Question classified as: {'MEDICAL' if is_medical else 'GENERAL'}")
    print(f"[DEBUG] Classify query: {classify_query}")
    
    # Prepare conversation messages (don't include current message yet)
    messages = conversation_history or []
    print(f"[DEBUG] Messages to send to GPT-4o: {len(messages)} history messages")
    
    rag_context = None
    sources = []
    rag_score = 0.0
    
    # For medical questions, try to get RAG context
    if is_medical:
        print(f"[DEBUG] Getting RAG context for medical question...")
        try:
            # Use weighted RAG search - prioritize current question over context
            rag_context, rag_score, sources = get_rag_context_weighted(
                current_message, 
                conversation_history
            )
            if rag_context:
                print(f"[DEBUG] Using RAG context (weighted score: {rag_score:.3f})")
                print(f"[DEBUG] RAG context preview: {rag_context[:200]}...")
                print(f"[DEBUG] Sources: {sources}")
            else:
                print(f"[DEBUG] No suitable RAG context found (weighted score: {rag_score:.3f})")
        except Exception as e:
            print(f"[DEBUG] RAG context error: {e}")
            # Continue without RAG context
    else:
        print(f"[DEBUG] Skipping RAG for general conversation")
    
    print(f"[DEBUG] Calling GPT-4o with {len(messages)} conversation messages")
    
    # Generate response with GPT-4o (with or without RAG enhancement)
    response = generate_response_with_gpt4o(messages, current_message, rag_context, sources, is_medical)
    
    print(f"[DEBUG] GPT-4o response: {response[:200]}...")
    
    # Format response with appropriate sources
    formatted_response, final_sources = format_response_with_sources(response, sources, {
        "is_medical": is_medical,
        "used_rag": rag_context is not None,
        "rag_score": rag_score,
        "model_used": "gpt-4o",
        "conversation_length": len(messages)
    })
    
    # Metadata for debugging/analytics
    metadata = {
        "is_medical": is_medical,
        "used_rag": rag_context is not None,
        "rag_score": rag_score,
        "model_used": "gpt-4o",
        "conversation_length": len(messages),
        "sources_count": len(final_sources)
    }
    
    print(f"[DEBUG] Final metadata: {metadata}")
    
    return formatted_response, final_sources, metadata

# --------------------------------------------------------------------------- #
# Backward compatibility function
# --------------------------------------------------------------------------- #
def answer_legacy(query: str) -> Tuple[Optional[str], float, List[str]]:
    """
    Legacy function signature for backward compatibility.
    Returns (response | None, score, sources) - None means fallback needed
    
    NOTE: This is deprecated. New code should use answer() function.
    """
    response, sources, metadata = answer(query)
    
    # For legacy compatibility, never return None (always have GPT-4o fallback)
    # But we'll simulate the old behavior for any calling code that expects it
    if not metadata["used_rag"]:
        # If no RAG was used, return None to trigger fallback in old code
        return None, metadata["rag_score"], sources
    
    return response, metadata["rag_score"], sources