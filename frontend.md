## Frontend Deployment

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### Development Deployment
1. Navigate to the frontend directory:
   ```sh
   cd frontend
   ```

2. Install dependencies:
   ```sh
   npm install
   # or
   yarn
   ```

3. Start the development server:
   ```sh
   npm run dev
   # or
   yarn dev
   ```
   
4. Access the application at http://localhost:3000

### Production Deployment

#### Option 1: Deploy to Vercel (Recommended)
1. Install the Vercel CLI:
   ```sh
   npm install -g vercel
   ```

2. Navigate to the frontend directory and run:
   ```sh
   vercel
   ```

3. Follow the prompts to configure your deployment.

#### Option 2: Static Export
1. Build the application:
   ```sh
   npm run build
   # or
   yarn build
   ```

2. Generate static files:
   ```sh
   npm run export
   # or
   yarn export
   ```

3. The static site will be available in the `out` directory, which can be deployed to any static hosting service like AWS S3, Netlify, or GitHub Pages.

#### Option 3: Docker Deployment
1. Build the Docker image:
   ```sh
   docker build -t ai-candidate-scoring-frontend .
   ```

2. Run the container:
   ```sh
   docker run -p 3000:3000 ai-candidate-scoring-frontend
   ```

### Environment Configuration
Create a `.env.local` file in the frontend directory with the following variables:
```env
NEXT_PUBLIC_API_URL=http://your-backend-url:5000
NEXT_PUBLIC_LIVEKIT_URL=wss://your-livekit-url
```

### Troubleshooting
- If you encounter CORS issues, ensure your backend is properly configured to accept requests from your frontend domain.
- For WebRTC functionality, ensure the application is served over HTTPS in production environments.