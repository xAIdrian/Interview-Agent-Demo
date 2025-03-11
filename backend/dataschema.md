# campaigns

id (PK)
title
max_user_submissions
max_points
is_public (bool) default: false
campaign_context: Context for the AI to use to understand the goals of HR.

# questions
id (pk)
campaign_id (fk)
title
body
scoring_prompt
max_points

# submissions

id (PK)
campaign_id (fk)
user_id (fk)
creation_time (default current timestamp)
completion_time (defaul null)
is_complete (bool)
total_points

# submission_answers
id (pk)
submission_id (fk)
question_id (fk)
video_path
transcript
score (int) default NULL
score_rationale (varchar(1000)) default NULL

# users
id (PK)
email
name
password_hash
is_admin (bool)