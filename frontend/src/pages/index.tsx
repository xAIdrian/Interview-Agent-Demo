// pages/index.tsx
import { GetServerSideProps } from 'next';

export const getServerSideProps: GetServerSideProps = async (context) => {
  return {
    redirect: {
      destination: '/login',
      permanent: false, // Set to true if you want a 308 permanent redirect
    },
  };
};

const Home = () => {
  return null; // This component will never be rendered
};

export default Home;
