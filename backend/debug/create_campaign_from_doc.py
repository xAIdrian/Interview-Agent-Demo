from openai import OpenAI
import json
client = OpenAI()

document_content = """
About the job
About Nabrio

At Nabrio, we are redefining AI Automation with our low-code, plug-and-play, edge-computing platforms. Our mission is to empower human potential through intelligent automation, enabling businesses to enhance efficiency, scalability, and quality in industries like manufacturing, packaging, agriculture, and beyond. By simplifying the AI adoption process—from data collection and model training (Reva) to seamless automation deployment (Nara)—we make AI integration accessible, adaptable, and results-driven.

 



About the Role

As a Physical AI Automation Solutions Architect, you will play a key role in designing and deploying real-world AI automation solutions. Working closely with clients, system integrators, and product teams, you will identify industry challenges, develop tailored AI solutions, and refine Nabrio’s platform capabilities. This role blends technical expertise, problem-solving, and client-facing collaboration to drive adoption and ensure successful implementations of Nabrio’s AI-powered automation tools.

 

 

Key Responsibilities

Design and implement AI automation solutions using Nabrio’s low-code, edge-computing technology.
Engage with clients and system integrators to understand industry needs and develop tailored automation solutions.
Aggregate industry insights to drive product innovation and new use cases.
Provide feedback to product and engineering teams to enhance UI, capabilities, and integration efficiency.
Optimize automation processes across industries, improving tracking, production efficiency, and quality control.
 

 

What You Bring

Solutions-driven mindset, with a passion for automation, efficiency, and system integration.
Experience in client services or client-facing roles, preferably in industrial automation, manufacturing, or technology sectors.
Technical proficiency in control & automation systems, IT infrastructure, and system integration.
Experience with automation hardware (PLCs, SCADAs, etc), vision systems, robotics and IT hardware.
Strong analytical and problem-solving skills with a hands-on approach.
Excellent communication and interpersonal skills, with a sales-oriented mindset preferred.
Familiarity with computer vision and machine learning (ML) technologies is a plus.
Bachelor’s degree or equivalent in Control & Automation Engineering, Mechatronics Engineering or related field preferred.
Fluency in Thai and English is required.
 

 

The fine print

To be considered for the application, please share with us cover letter of <500 words outlining a brief use case for Nabrio's automation AI solutions.

 

Prompt: Choose any industry, or function, you are familiar with and imagine a use case where Nabrio's capabilities can add value to a client in this business. Strong answers will include both concept as well as an outline of any technical requirements.

 

Join Nabrio and be part of the next wave of intelligent automation, transforming industries and unlocking new possibilities.


show less
Requirements added by the job poster
Professional in English
Professional in Thai
"""

context_creation_prompt = """Pull one paragraph from job description if it exists, otherwise write a one-paragraph job description. No quotes.

{document}"""

question_creation_prompt = """Based on the job description provided below, generate questions for a candidate, along with the maximum number of points for a complete answer, and scoring criteria for each question.

Specify what criteria constitutes full points, half points, and no points. Be clear in your definition. Start your prompt with "Full points awarded with." Do not include the number of points in the scoring criteria.

By default, make each question 10 points max. Make more important questions worth 20 points max.

Create your output as a json array containing dictionaries without markdown. Each dictionary must include the keys: question, max_points, scoring_prompt

---

{document}
"""

completion = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[
        {
            "role": "user",
            "content": context_creation_prompt.format(
                document=document_content
            )
        }
    ]
)
print(completion.choices[0].message.content)


completion = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[
        {
            "role": "user",
            "content": question_creation_prompt.format(
                document=document_content
            )
        }
    ]
)
json_output = json.loads(completion.choices[0].message.content)
print(json_output)