// src/services/achievementService.ts
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
    icon: string;
    unlocked: boolean;
}

const ALL_ACHIEVEMENTS: Achievement[] = [
    { key: AchievementKey.FIRST_PURCHASE, title: "First Purchase Pioneer", description: "Completed your first ticket purchase!", icon: "🎟️", unlocked: false },
    { key: AchievementKey.TEN_TICKETS, title: "Ten Ticket Knight", description: "Purchased a total of 10 tickets.", icon: "✨", unlocked: false },
    { key: AchievementKey.FIFTY_TICKETS, title: "Fifty Ticket Lord", description: "Purchased a total of 50 tickets.", icon: "👑", unlocked: false },
    { key: AchievementKey.HUNDRED_TICKETS, title: "King of a Hundred Tickets", description: "Purchased a total of 100 tickets.", icon: "🏆", unlocked: false },
    { key: AchievementKey.LUCKY_STAR, title: "Lucky Star", description: "Won a lottery prize for the first time!", icon: "⭐", unlocked: false },
    { key: AchievementKey.POPULAR_REFERRER, title: "Popular Referrer", description: "Successfully referred 5 friends.", icon: "❤️", unlocked: false },
    { key: AchievementKey.SUPER_REFERRER, title: "Super Referrer", description: "Successfully referred 10 friends.", icon: "🔥", unlocked: false },
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