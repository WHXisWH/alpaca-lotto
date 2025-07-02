import React from 'react';
import { Box } from '@chakra-ui/react';

const animationKeyframes = `
  @keyframes runAnimation {
    from { background-position: 0 0; }
    to { background-position: -2048px 0; }
  }
`;

const animationStyle = 'runAnimation 0.5s steps(4) infinite';

export const LoadingAlpaca: React.FC<{ size?: string }> = ({ size = '100px' }) => {
  const baseWidth = 512;
  const baseHeight = 512;

  const finalSize = size;

  const backgroundWidth = (parseInt(finalSize) / baseWidth) * (baseWidth * 4);
  const backgroundHeight = (parseInt(finalSize) / baseWidth) * baseHeight;

  return (
    <>
      <style>{animationKeyframes}</style>
      <Box
        width={finalSize}
        height={finalSize}
        backgroundImage="url('/images/loading-alpaca.png')"
        backgroundRepeat="no-repeat"
        backgroundSize={`${backgroundWidth}px ${backgroundHeight}px`}
        animation={animationStyle}
      />
    </>
  );
};