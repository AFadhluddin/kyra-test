"""Question categorization service using LLM to classify questions into consistent categories."""
import os
from typing import List, Optional
import openai
from dotenv import load_dotenv

load_dotenv(override=True)

openai_client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Define consistent categories for medical questions
MEDICAL_CATEGORIES = [
    "Symptoms & Diagnosis",
    "Treatment & Medication", 
    "Prevention & Lifestyle"
]

CATEGORIZATION_PROMPT = """
You are a question categorizer. For each question, return:
- The main category (choose one: Symptoms & Diagnosis, Treatment & Medication, Prevention & Lifestyle)
- If the question is about a specific disease or condition, add it after a comma (e.g. Symptoms & Diagnosis, Diabetes)
- If not about a specific disease/condition, just return the category

Available categories:
1. Symptoms & Diagnosis
2. Treatment & Medication
3. Prevention & Lifestyle
4. General

Rules:
- Always return the category first
- If a disease/condition is mentioned, add it after a comma
- If not, just return the category
- Be consistent across similar questions
- Return ONLY the category (and disease/condition if present), nothing else

Examples:
"What are the symptoms of diabetes?" → "Symptoms & Diagnosis, Diabetes"
"How is diabetes treated?" → "Treatment & Medication, Diabetes"
"How can I prevent diabetes?" → "Prevention & Lifestyle, Diabetes"
"What medications are used for high blood pressure?" → "Treatment & Medication, High Blood Pressure"
"What causes migraines?" → "Symptoms & Diagnosis, Migraines"
"How can I lower my cholesterol naturally?" → "Prevention & Lifestyle, Cholesterol"
"Tell me a joke" → "General"
"What's the weather like?" → "General"

Question: "{question}"
Category:"""

def categorize_question(question: str) -> Optional[str]:
    """
    Categorize a medical question into one of the predefined categories.
    
    Args:
        question: The medical question to categorize
        
    Returns:
        Category name or None if categorization fails
    """
    try:
        response = openai_client.chat.completions.create(
            model="gpt-4o-mini",  # Use mini for cost efficiency
            messages=[
                {"role": "user", "content": CATEGORIZATION_PROMPT.format(question=question)}
            ],
            max_tokens=20,
            temperature=0.1  # Low temperature for consistent categorization
        )
        
        category = response.choices[0].message.content.strip()
        
        # Validate that the response is one of our expected categories
        if category in MEDICAL_CATEGORIES:
            return category
        else:
            print(f"[DEBUG] Unexpected category response: '{category}' for question: '{question}'")
            # Default to first category if response is unexpected
            return MEDICAL_CATEGORIES[0]
            
    except Exception as e:
        print(f"[DEBUG] Categorization error for question '{question}': {e}")
        return None

def get_available_categories() -> List[str]:
    """Get the list of available categories for reference."""
    return MEDICAL_CATEGORIES.copy() 