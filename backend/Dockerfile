FROM python:3.9-slim

# Set working directory
WORKDIR /app

# Install system dependencies including MariaDB Connector/C
RUN apt-get update && apt-get install -y \
    build-essential \
    libmariadb3 \
    libmariadb-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the application code
COPY . .

# Create logs directory
RUN mkdir -p /app/logs

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app

# Run the interview agent
CMD ["python", "livekit/interview_agent.py", "start"]
