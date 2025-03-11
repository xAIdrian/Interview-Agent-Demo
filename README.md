
<img align="right" width="250" src="https://github.com/user-attachments/assets/a69f22f6-5958-4cc7-921a-5570f2b060a8"/>

### AI Candidate Scoring

[Click here to view the project on Notion](https://www.notion.so/adrianmohnacs/Projects-Pok-dex-f99abda38000453a9f584c7139b9222b?p=19f5c918fe368117a57cd938148733b9&pm=c)

### Dependencies

Project is dependent on MariaDB you can get this running on a mac with 

make sure you install whisper with 
```
pip install git+https://github.com/openai/whisper.git
```

```
brew services start mariadb
```

Running our flask server with a work thread kicked off
```
python3 app.py
python3 agent.py dev

# options
Commands:
  connect         Connect to a specific room
  dev             Start the worker in development mode
  download-files  Download plugin dependency files
  start           Start the worker in production mode.
```

Run our Next.js (frontend only) with our command:
```
npm run dev
```

