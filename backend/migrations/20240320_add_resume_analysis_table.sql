-- Create resume_analysis table
CREATE TABLE IF NOT EXISTS resume_analysis (
    id TEXT PRIMARY KEY,
    submission_id TEXT NOT NULL,
    strengths TEXT,
    weaknesses TEXT,
    overall_fit TEXT,
    percent_match INTEGER,
    percent_match_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_resume_analysis_submission_id ON resume_analysis(submission_id); 
