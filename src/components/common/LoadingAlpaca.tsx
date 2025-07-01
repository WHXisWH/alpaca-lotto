import React from 'react';
import { Box } from '@chakra-ui/react';

const animationKeyframes = `
  @keyframes runAnimation {
    from { background-position: 0 0; }
    to { background-position: -400px 0; }
  }
`;

const animationStyle = 'runAnimation 0.5s steps(4) infinite';

export const LoadingAlpaca: React.FC<{ size?: string }> = ({ size = '100px' }) => {
  return (
    <>
      <style>{animationKeyframes}</style>
      <Box
        width={size}
        height={size}
        backgroundImage="url('/images/loading-alpaca.png')"
        backgroundRepeat="no-repeat"
        animation={animationStyle}
      />
    </>
  );
};