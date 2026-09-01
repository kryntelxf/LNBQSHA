// LNBQSHA — JavaScript/TypeScript Client SDK
// For web, React Native, and Node.js applications

export interface LNBQSHAConfig {
    baseUrl: string;
    apiKey?: string;
    timeout?: number;
}

export interface User {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string;
    status: 'online' | 'offline' | 'playing';
    level: number;
    xp: number;
}

export interface Wallet {
    userId: string;
    softBalance: number;
    premiumBalance: number;
    totalEarned: number;
    totalSpent: number;
}

export interface InventoryItem {
    itemId: string;
    name: string;
    type: string;
    rarity: string;
    equipped: boolean;
    unlockedAt: number;
}

export interface Progression {
    userId: string;
    level: number;
    xp: number;
    xpToNextLevel: number;
    totalXp: number;
    achievements: any[];
}

export interface Friend {
    userId: string;
    username: string;
    displayName: string;
    avatarUrl: string;
    status: string;
    currentActivity: string;
}

export interface Party {
    id: string;
    leaderId: string;
    members: any[];
    maxMembers: number;
    gameMode: string;
}

export class LNBQSHA {
    private config: LNBQSHAConfig;
    private token: string | null = null;

    constructor(config: LNBQSHAConfig) {
        this.config = config;
    }

    private async request(method: string, payload: any = {}): Promise<any> {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json'
        };
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }
        if (this.config.apiKey) {
            headers['X-API-Key'] = this.config.apiKey;
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.config.timeout || 30000);

        try {
            const response = await fetch(`${this.config.baseUrl}/v2/rpc/${method}`, {
                method: 'POST',
                headers,
                body: JSON.stringify(payload),
                signal: controller.signal
            });
            clearTimeout(timeout);
            const data = await response.json();
            if (data.error) {
                throw new Error(data.error);
            }
            return data;
        } catch (error) {
            clearTimeout(timeout);
            throw error;
        }
    }

    // ============================================================
    // AUTH
    // ============================================================

    async authenticateDevice(deviceId: string): Promise<{ token: string; user: User }> {
        // This would call Nakama's native authenticate API
        // For now, we simulate
        this.token = 'simulated_token';
        return {
            token: this.token,
            user: {
                id: 'user_123',
                username: 'player_' + deviceId.substring(0, 6),
                displayName: '',
                avatarUrl: '',
                status: 'offline',
                level: 1,
                xp: 0
            }
        };
    }

    setToken(token: string) {
        this.token = token;
    }

    getToken(): string | null {
        return this.token;
    }

    // ============================================================
    // PLAYER
    // ============================================================

    async getProfile(): Promise<User> {
        return this.request('player.getState');
    }

    async updateProfile(updates: { displayName?: string; avatarUrl?: string; bio?: string }): Promise<User> {
        return this.request('player.updateState', updates);
    }

    async getProfileByUserId(userId: string): Promise<User> {
        return this.request('player.getStateByUserId', { userId });
    }

    // ============================================================
    // ECONOMY
    // ============================================================

    async getWallet(): Promise<Wallet> {
        return this.request('economy.getWallet');
    }

    async purchaseItem(itemId: string, idempotencyKey?: string): Promise<any> {
        return this.request('economy.purchase', {
            itemId,
            idempotencyKey: idempotencyKey || crypto.randomUUID()
        });
    }

    // ============================================================
    // INVENTORY
    // ============================================================

    async getInventory(): Promise<{ items: InventoryItem[]; equipped: Record<string, string> }> {
        return this.request('inventory.get');
    }

    async equipItem(itemId: string): Promise<any> {
        return this.request('inventory.equip', { itemId });
    }

    async unequipItem(itemId: string): Promise<any> {
        return this.request('inventory.unequip', { itemId });
    }

    async hasItem(itemId: string): Promise<boolean> {
        const result = await this.request('inventory.has', { itemId });
        return result.owned;
    }

    // ============================================================
    // PROGRESSION
    // ============================================================

    async getProgression(): Promise<Progression> {
        return this.request('progression.get');
    }

    async addXp(amount: number): Promise<Progression> {
        return this.request('progression.addXp', { amount });
    }

    async claimDailyReward(): Promise<any> {
        return this.request('progression.claimDailyReward');
    }

    // ============================================================
    // SOCIAL
    // ============================================================

    async getFriends(): Promise<Friend[]> {
        const result = await this.request('social.getFriends');
        return result.friends || [];
    }

    async getFriendsOfFriends(): Promise<any> {
        return this.request('social.friendsOfFriends');
    }

    async followUser(userId: string): Promise<void> {
        await this.request('social.follow', { userId });
    }

    async unfollowUser(userId: string): Promise<void> {
        await this.request('social.unfollow', { userId });
    }

    async getPresence(userIds: string[]): Promise<any> {
        return this.request('social.getPresence', { userIds });
    }

    async getOnlineFriends(): Promise<Friend[]> {
        const result = await this.request('social.getOnlineFriends');
        return result.online || [];
    }

    async getActivityFeed(limit: number = 20): Promise<any> {
        return this.request('social.getActivityFeed', { limit });
    }

    // ============================================================
    // PARTY
    // ============================================================

    async createParty(gameMode: string = 'default'): Promise<Party> {
        return this.request('party.create', { gameMode });
    }

    async joinParty(partyId: string): Promise<Party> {
        return this.request('party.join', { partyId });
    }

    async leaveParty(partyId: string): Promise<void> {
        await this.request('party.leave', { partyId });
    }

    async getParty(partyId: string): Promise<Party> {
        return this.request('party.get', { partyId });
    }

    async getUserParty(): Promise<Party | null> {
        const result = await this.request('party.getUserParty');
        return result.party || null;
    }

    // ============================================================
    // MATCHMAKING
    // ============================================================

    async startMatchmaking(gameMode: string = 'default'): Promise<any> {
        return this.request('matchmaking.start', { gameMode });
    }

    async cancelMatchmaking(): Promise<void> {
        await this.request('matchmaking.cancel');
    }

    // ============================================================
    // GAME — Obstacle Rush
    // ============================================================

    async startGame(): Promise<any> {
        return this.request('game.start');
    }

    async updateGame(deltaTime: number): Promise<any> {
        return this.request('game.update', { deltaTime });
    }

    async endGame(): Promise<any> {
        return this.request('game.end');
    }

    async getGameState(): Promise<any> {
        return this.request('game.getState');
    }

    async joinObstacleRushQueue(): Promise<any> {
        return this.request('obstacle_rush.joinQueue');
    }

    async cancelObstacleRushQueue(): Promise<any> {
        return this.request('obstacle_rush.cancelQueue');
    }

    // ============================================================
    // LEADERBOARD
    // ============================================================

    async submitScore(score: number, leaderboardId: string = 'global', metadata?: any): Promise<any> {
        return this.request('leaderboard.submitScore', {
            leaderboardId,
            score,
            metadata
        });
    }

    async getLeaderboard(leaderboardId: string = 'global', limit: number = 100, offset: number = 0): Promise<any> {
        return this.request('leaderboard.get', { leaderboardId, limit, offset });
    }

    async getUserRank(leaderboardId: string = 'global'): Promise<any> {
        return this.request('leaderboard.getUserRank', { leaderboardId });
    }

    // ============================================================
    // TOURNAMENT
    // ============================================================

    async joinTournament(tournamentId: string): Promise<any> {
        return this.request('tournament.join', { tournamentId });
    }

    async submitTournamentScore(tournamentId: string, score: number): Promise<any> {
        return this.request('tournament.submitScore', { tournamentId, score });
    }

    async getTournament(tournamentId: string): Promise<any> {
        return this.request('tournament.get', { tournamentId });
    }

    async getActiveTournaments(): Promise<any> {
        return this.request('tournament.getActive');
    }

    async claimTournamentPrize(tournamentId: string): Promise<any> {
        return this.request('tournament.claimPrize', { tournamentId });
    }

    // ============================================================
    // SHOP
    // ============================================================

    async getShopCatalog(category?: string, limit: number = 50, offset: number = 0): Promise<any> {
        return this.request('shop.getCatalog', { category, limit, offset });
    }

    async purchaseFromShop(itemId: string): Promise<any> {
        return this.request('shop.purchase', { itemId });
    }

    async getPurchaseHistory(limit: number = 50, offset: number = 0): Promise<any> {
        return this.request('shop.getHistory', { limit, offset });
    }

    async getDailyDeals(): Promise<any> {
        return this.request('shop.getDeals');
    }

    // ============================================================
    // CLAN
    // ============================================================

    async createClan(name: string, tag: string, description: string = ''): Promise<any> {
        return this.request('clan.create', { name, tag, description });
    }

    async joinClan(clanId: string): Promise<any> {
        return this.request('clan.join', { clanId });
    }

    async leaveClan(): Promise<any> {
        return this.request('clan.leave');
    }

    async getClan(clanId: string): Promise<any> {
        return this.request('clan.get', { clanId });
    }

    async getUserClan(): Promise<any> {
        return this.request('clan.getUserClan');
    }

    async promoteClanMember(userId: string): Promise<any> {
        return this.request('clan.promote', { userId });
    }

    async demoteClanMember(userId: string): Promise<any> {
        return this.request('clan.demote', { userId });
    }

    async addClanXp(amount: number): Promise<any> {
        return this.request('clan.addXp', { amount });
    }

    // ============================================================
    // NOTIFICATIONS
    // ============================================================

    async getNotifications(limit: number = 50, offset: number = 0): Promise<any> {
        return this.request('notification.get', { limit, offset });
    }

    async markNotificationRead(notificationId: string): Promise<void> {
        await this.request('notification.markRead', { notificationId });
    }

    async markAllNotificationsRead(): Promise<void> {
        await this.request('notification.markAllRead');
    }

    async deleteNotification(notificationId: string): Promise<void> {
        await this.request('notification.delete', { notificationId });
    }

    async getNotificationPreferences(): Promise<any> {
        return this.request('notification.getPrefs');
    }

    async updateNotificationPreferences(prefs: any): Promise<any> {
        return this.request('notification.updatePrefs', prefs);
    }

    // ============================================================
    // BATTLE PASS
    // ============================================================

    async getBattlePass(): Promise<any> {
        return this.request('battlepass.get');
    }

    async addBattlePassXp(amount: number): Promise<any> {
        return this.request('battlepass.addXp', { amount });
    }

    async claimBattlePassReward(tier: number, isPremium: boolean = false): Promise<any> {
        return this.request('battlepass.claim', { tier, isPremium });
    }

    async purchasePremiumBattlePass(): Promise<any> {
        return this.request('battlepass.purchase');
    }

    // ============================================================
    // ACHIEVEMENTS
    // ============================================================

    async getAchievements(): Promise<any> {
        return this.request('achievement.get');
    }

    async updateAchievementProgress(achievementId: string, amount: number = 1): Promise<any> {
        return this.request('achievement.update', { achievementId, amount });
    }

    // ============================================================
    // QUESTS
    // ============================================================

    async getQuests(): Promise<any> {
        return this.request('quest.get');
    }

    async claimQuestReward(questId: string): Promise<any> {
        return this.request('quest.claim', { questId });
    }

    // ============================================================
    // DAILY LOGIN
    // ============================================================

    async claimDailyLogin(): Promise<any> {
        return this.request('dailyLogin.claim');
    }

    async getDailyLoginStatus(): Promise<any> {
        return this.request('dailyLogin.status');
    }

    async getDailyLoginCalendar(): Promise<any> {
        return this.request('dailyLogin.calendar');
    }

    async getMonthlyLoginStats(): Promise<any> {
        return this.request('dailyLogin.stats');
    }

    // ============================================================
    // FRIEND ACTIVITY
    // ============================================================

    async getFriendActivity(limit: number = 50, offset: number = 0): Promise<any> {
        return this.request('friendActivity.get', { limit, offset });
    }

    async getUnreadActivityCount(): Promise<any> {
        return this.request('friendActivity.unreadCount');
    }

    async markActivityRead(activityId: string): Promise<void> {
        await this.request('friendActivity.markRead', { activityId });
    }

    async markAllActivityRead(): Promise<void> {
        await this.request('friendActivity.markAllRead');
    }

    // ============================================================
    // CHAT
    // ============================================================

    async getChatMessages(channelId: string, limit: number = 50, offset: number = 0): Promise<any> {
        return this.request('chat.getMessages', { channelId, limit, offset });
    }

    async sendChatMessage(channelId: string, message: string): Promise<any> {
        return this.request('chat.send', { channelId, message });
    }

    async createChatChannel(type: string, name: string, members: string[] = []): Promise<any> {
        return this.request('chat.createChannel', { type, name, members });
    }

    async joinChatChannel(channelId: string): Promise<any> {
        return this.request('chat.joinChannel', { channelId });
    }

    async leaveChatChannel(channelId: string): Promise<any> {
        return this.request('chat.leaveChannel', { channelId });
    }

    // ============================================================
    // GLOBAL CHAT
    // ============================================================

    async getGlobalMessages(limit: number = 50, offset: number = 0): Promise<any> {
        return this.request('globalChat.getMessages', { limit, offset });
    }

    async sendGlobalMessage(message: string): Promise<any> {
        return this.request('globalChat.send', { message });
    }

    async getGlobalChatStats(): Promise<any> {
        return this.request('globalChat.stats');
    }

    // ============================================================
    // CMS
    // ============================================================

    async getContentItems(type?: string, limit: number = 50, offset: number = 0): Promise<any> {
        return this.request('cms.getItems', { type, limit, offset });
    }

    async getContentItem(contentId: string): Promise<any> {
        return this.request('cms.getItem', { contentId });
    }

    async getCategories(): Promise<any> {
        return this.request('cms.getCategories');
    }

    // ============================================================
    // INTEGRATION
    // ============================================================

    async completePurchase(itemId: string): Promise<any> {
        return this.request('integration.purchase', { itemId });
    }

    async completeGame(score: number, gameMode: string = 'obstacle_rush', metadata?: any): Promise<any> {
        return this.request('integration.completeGame', {
            gameMode,
            score,
            metadata
        });
    }

    async dailyLogin(): Promise<any> {
        return this.request('integration.dailyLogin');
    }

    async getDashboard(): Promise<any> {
        return this.request('integration.getDashboard');
    }

    // ============================================================
    // UTILITY
    // ============================================================

    async healthCheck(): Promise<any> {
        return this.request('server.health');
    }

    async getServerInfo(): Promise<any> {
        return this.request('server.info');
    }
}

export default LNBQSHA;
