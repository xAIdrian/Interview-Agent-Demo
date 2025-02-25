# candidates

id (PK)
email
password_hash (if you store credentials)
name
created_at

# interviews

id (PK)
candidate_id (FK to candidates)
status (e.g., “scheduled”, “in-progress”, “completed”)
video_url (S3 link)
created_at

# transcripts

id (PK)
interview_id (FK to interviews)
transcript_text (TEXT)

# scores

id (PK)
candidate_id (FK to candidates)
interview_id (FK to interviews)
score_value (numeric)
strengths_weaknesses (TEXT or JSON for storing feedback)

# campaigns (if separate from interviews)

id (PK)
name
description
created_at