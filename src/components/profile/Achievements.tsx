import React from 'react';
import { Box, SimpleGrid, Text, VStack, Heading, Image } from '@chakra-ui/react'; // 1. 引入 Image 組件
import { Tooltip } from '@/components/ui/tooltip';
import { Achievement } from '@/services/achievementService';

interface AchievementsProps {
  achievements: Achievement[];
}

export const Achievements: React.FC<AchievementsProps> = ({ achievements }) => {
  const cardBg = "white";
  const borderColor = "gray.200";
  const lockedColor = "gray.400";
  const unlockedColor = "yellow.900";
  const iconBgLocked = "gray.200";
  const iconBgUnlocked = "yellow.100";
  
  return (
    <Box>
       <Heading size="lg" color="green.600" mb={4}>My Badge Wall</Heading>
        <SimpleGrid columns={{ base: 2, sm: 3, md: 4 }} gap={6}>
        {achievements.map((ach) => (
            <Tooltip key={ach.key} content={ach.description} showArrow>
                <VStack
                    p={4}
                    bg={cardBg}
                    borderRadius="xl"
                    borderWidth="1px"
                    borderColor={ach.unlocked ? 'green.400' : borderColor}
                    boxShadow={ach.unlocked ? "md" : "sm"}
                    opacity={ach.unlocked ? 1 : 0.5}
                    transform={ach.unlocked ? "scale(1.05)" : "scale(1)"}
                    transition="all 0.2s ease-in-out"
                    cursor="pointer"
                >
                    {/* 2. 將原來的 Box 改為使用 Image 組件 */}
                    <Image
                        src={ach.icon}
                        alt={ach.title}
                        boxSize="80px"
                        objectFit="cover"
                        bg={ach.unlocked ? iconBgUnlocked : iconBgLocked}
                        borderRadius="full"
                        p={ach.icon.includes('pixel-art') ? 0 : 2} // Optional: Add padding for non-pixel art
                        mb={2}
                    />
                    <Text fontWeight="bold" color={ach.unlocked ? unlockedColor : lockedColor} textAlign="center">
                        {ach.title}
                    </Text>
                </VStack>
            </Tooltip>
        ))}
        </SimpleGrid>
    </Box>
  );
};