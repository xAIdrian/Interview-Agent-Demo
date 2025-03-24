from openai import OpenAI
client = OpenAI()

scoring_prompt_optimization_system = """Optimize this scoring prompt created by an admin to score a candidate's response.

Specify what criteria constitutes full points, half points, and no points. Be clear in your definition. Start your prompt with "Full points awarded with"

Only output your updated scoring prompt

--

Hiring Campaign: {campaign_name}
Role information: {campaign_context}
Question: {question}
Original scoring prompt: {scoring_prompt}

"""

def optimize_with_ai(campaign_name, campaign_context, question, scoring_prompt):
    completion = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {
                "role": "user",
                "content": scoring_prompt_optimization_system.format(
                    campaign_name=campaign_name,
                    campaign_context=campaign_context,
                    question=question,
                    scoring_prompt=scoring_prompt
                )
            }
        ]
    )
    return completion.choices[0].message.content

print(optimize_with_ai("HR Manager", "responsible for leading the marketing team", "What's your name", "full name"))