export enum AchievementKey {
    FIRST_PURCHASE = "FIRST_PURCHASE",
    TEN_TICKETS = "TEN_TICKETS",
    FIFTY_TICKETS = "FIFTY_TICKETS",
    HUNDRED_TICKETS = "HUNDRED_TICKETS",
    LUCKY_STAR = "LUCKY_STAR",
    POPULAR_REFERRER = "POPULAR_REFERRER",
    SUPER_REFERRER = "SUPER_REFERRER",
}

export interface Achievement {
    key: AchievementKey;
    title: string;
    description: string;
    icon: string; // The type is now a path string
    unlocked: boolean;
}

const ALL_ACHIEVEMENTS: Achievement[] = [
    { 
        key: AchievementKey.FIRST_PURCHASE, 
        title: "Pioneer Alpaca", 
        description: "Completed your first ticket purchase and began the adventure!", 
        icon: "/images/first-purchase-pioneer.png", 
        unlocked: false 
    },
    { 
        key: AchievementKey.LUCKY_STAR, 
        title: "Lucky Star", 
        description: "Won a lottery prize for the first time!", 
        icon: "/images/lucky-star.png", 
        unlocked: false 
    },
    { 
        key: AchievementKey.TEN_TICKETS, 
        title: "Ticket Collector", 
        description: "Collected a total of 10 tickets. A great start!", 
        icon: "/images/ticket-collector.png", 
        unlocked: false 
    },
    { 
        key: AchievementKey.FIFTY_TICKETS, 
        title: "Ticket Enthusiast", 
        description: "Your collection has grown to 50 tickets. Impressive!", 
        icon: "/images/ticket-enthusiast.png", 
        unlocked: false 
    },
    { 
        key: AchievementKey.HUNDRED_TICKETS, 
        title: "King of a Hundred Tickets", 
        description: "You are the king, with 100 tickets in your domain!", 
        icon: "/images/king-of-a-hundred-tickets.png", 
        unlocked: false 
    },
    { 
        key: AchievementKey.POPULAR_REFERRER, 
        title: "Popular Referrer", 
        description: "Successfully referred 5 friends to the herd!", 
        icon: "/images/popular-referrer.png", 
        unlocked: false 
    },
    { 
        key: AchievementKey.SUPER_REFERRER, 
        title: "Social Butterfly", 
        description: "You've successfully referred 10 friends and are the life of the party!", 
        icon: "/images/social-butterfly.png", 
        unlocked: false 
    },
];

const STORAGE_KEY_PREFIX = 'alpaca_achievements_';

class AchievementService {
    private getStorageKey(userAddress: string): string {
        return `${STORAGE_KEY_PREFIX}${userAddress.toLowerCase()}`;
    }

    getAchievements(userAddress: string): Achievement[] {
        if (!userAddress) return ALL_ACHIEVEMENTS.map(a => ({ ...a, unlocked: false }));

        const storedKeys: string[] = JSON.parse(localStorage.getItem(this.getStorageKey(userAddress)) || '[]');
        return ALL_ACHIEVEMENTS.map(achievement => ({
            ...achievement,
            unlocked: storedKeys.includes(achievement.key),
        }));
    }

    unlockAchievement(userAddress: string, achievementKey: AchievementKey): boolean {
        if (!userAddress) return false;

        const storageKey = this.getStorageKey(userAddress);
        const storedKeys: string[] = JSON.parse(localStorage.getItem(storageKey) || '[]');
        
        if (!storedKeys.includes(achievementKey)) {
            storedKeys.push(achievementKey);
            localStorage.setItem(storageKey, JSON.stringify(storedKeys));
            return true;
        }
        return false;
    }

    checkAndUnlockTicketMilestones(userAddress: string, totalTickets: number): AchievementKey[] {
        const unlocked: AchievementKey[] = [];
        if (totalTickets > 0 && this.unlockAchievement(userAddress, AchievementKey.FIRST_PURCHASE)) {
            unlocked.push(AchievementKey.FIRST_PURCHASE);
        }
        if (totalTickets >= 10 && this.unlockAchievement(userAddress, AchievementKey.TEN_TICKETS)) {
            unlocked.push(AchievementKey.TEN_TICKETS);
        }
        if (totalTickets >= 50 && this.unlockAchievement(userAddress, AchievementKey.FIFTY_TICKETS)) {
            unlocked.push(AchievementKey.FIFTY_TICKETS);
        }
        if (totalTickets >= 100 && this.unlockAchievement(userAddress, AchievementKey.HUNDRED_TICKETS)) {
            unlocked.push(AchievementKey.HUNDRED_TICKETS);
        }
        return unlocked;
    }
}

export const achievementService = new AchievementService();