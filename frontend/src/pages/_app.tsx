   // pages/_app.tsx
   import '../styles/globals.css'; // Adjust the path if necessary

   function MyApp({ Component, pageProps }: { Component: React.ComponentType; pageProps: any }) {
     return <Component {...pageProps} />;
   }

   export default MyApp;
