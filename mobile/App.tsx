// LNBQSHA Mobile App — React Native
// iOS & Android client for LNBQSHA

import React, { useState, useEffect } from 'react';
import {
    SafeAreaView,
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    ScrollView,
    TextInput,
    FlatList,
    Image,
    StatusBar,
    ActivityIndicator,
    Alert,
} from 'react-native';

// ============================================================
// TYPES
// ============================================================

interface User {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string;
    status: 'online' | 'offline' | 'playing';
}

interface Wallet {
    softBalance: number;
    premiumBalance: number;
    totalEarned: number;
    totalSpent: number;
}

interface Game {
    id: string;
    name: string;
    icon: string;
    players: number;
    tag: 'hot' | 'new' | 'popular';
}

// ============================================================
// MOCK DATA
// ============================================================

const mockUser: User = {
    id: 'user_123',
    username: 'PlayerOne',
    displayName: 'PlayerOne',
    avatarUrl: '🧑',
    status: 'online',
};

const mockWallet: Wallet = {
    softBalance: 1250,
    premiumBalance: 50,
    totalEarned: 2500,
    totalSpent: 1250,
};

const mockGames: Game[] = [
    { id: 'obstacle_rush', name: 'Obstacle Rush', icon: '🏃', players: 234, tag: 'hot' },
    { id: 'block_battle', name: 'Block Battle', icon: '🧱', players: 89, tag: 'new' },
    { id: 'coin_race', name: 'Coin Race', icon: '🪙', players: 567, tag: 'popular' },
    { id: 'puzzle_quest', name: 'Puzzle Quest', icon: '🧩', players: 45, tag: 'new' },
    { id: 'space_war', name: 'Space War', icon: '🚀', players: 123, tag: 'hot' },
];

const mockLeaderboard = [
    { rank: 1, name: 'LegendPlayer', score: 12500 },
    { rank: 2, name: 'GameMaster', score: 9800 },
    { rank: 3, name: 'NeonRider', score: 7500 },
    { rank: 4, name: 'ShadowRunner', score: 6200 },
    { rank: 5, name: 'CryptoKing', score: 5100 },
];

// ============================================================
// SCREENS
// ============================================================

const HomeScreen = ({ navigation }: any) => {
    const [user] = useState<User>(mockUser);
    const [wallet] = useState<Wallet>(mockWallet);

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#05050a" />

            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.logo}>LNB<span style={{color:'#7c3aed'}}>QSHA</span></Text>
                <TouchableOpacity style={styles.avatarButton} onPress={() => navigation.navigate('Profile')}>
                    <Text style={styles.avatarEmoji}>{user.avatarUrl}</Text>
                </TouchableOpacity>
            </View>

            {/* Wallet */}
            <View style={styles.walletCard}>
                <Text style={styles.walletTitle}>💰 Wallet</Text>
                <View style={styles.walletRow}>
                    <View>
                        <Text style={styles.walletLabel}>Soft Coins</Text>
                        <Text style={styles.walletValue}>{wallet.softBalance}</Text>
                    </View>
                    <View>
                        <Text style={styles.walletLabel}>Gems</Text>
                        <Text style={styles.walletValue}>{wallet.premiumBalance}</Text>
                    </View>
                </View>
            </View>

            {/* Games */}
            <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>🎮 Popular Games</Text>
                <TouchableOpacity>
                    <Text style={styles.seeAll}>See All</Text>
                </TouchableOpacity>
            </View>

            <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                data={mockGames}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                    <TouchableOpacity
                        style={styles.gameCard}
                        onPress={() => navigation.navigate('Game', { gameId: item.id })}
                    >
                        <Text style={styles.gameIcon}>{item.icon}</Text>
                        <Text style={styles.gameName}>{item.name}</Text>
                        <View style={styles.gameMeta}>
                            <Text style={styles.gamePlayers}>👤 {item.players}</Text>
                            <View style={[styles.gameTag, styles[`tag_${item.tag}`]]}>
                                <Text style={styles.gameTagText}>{item.tag}</Text>
                            </View>
                        </View>
                    </TouchableOpacity>
                )}
                contentContainerStyle={styles.gamesList}
            />

            {/* Leaderboard */}
            <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>🏆 Top Players</Text>
                <TouchableOpacity>
                    <Text style={styles.seeAll}>See All</Text>
                </TouchableOpacity>
            </View>

            {mockLeaderboard.slice(0, 3).map((item, index) => (
                <View key={item.rank} style={styles.leaderboardItem}>
                    <Text style={styles.leaderboardRank}>#{item.rank}</Text>
                    <Text style={styles.leaderboardName}>{item.name}</Text>
                    <Text style={styles.leaderboardScore}>{item.score.toLocaleString()}</Text>
                </View>
            ))}

            {/* Bottom Navigation */}
            <View style={styles.bottomNav}>
                <TouchableOpacity style={styles.navItem}>
                    <Text style={styles.navIcon}>🏠</Text>
                    <Text style={styles.navLabel}>Home</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Games')}>
                    <Text style={styles.navIcon}>🎮</Text>
                    <Text style={styles.navLabel}>Games</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Social')}>
                    <Text style={styles.navIcon}>👥</Text>
                    <Text style={styles.navLabel}>Social</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Profile')}>
                    <Text style={styles.navIcon}>👤</Text>
                    <Text style={styles.navLabel}>Profile</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};

const GamesScreen = () => {
    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#05050a" />
            <View style={styles.header}>
                <Text style={styles.logo}>🎮 <Text style={{color:'#7c3aed'}}>Games</Text></Text>
            </View>
            <FlatList
                data={mockGames}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                    <View style={styles.gameListItem}>
                        <Text style={styles.gameListIcon}>{item.icon}</Text>
                        <View style={styles.gameListInfo}>
                            <Text style={styles.gameListName}>{item.name}</Text>
                            <Text style={styles.gameListPlayers}>👤 {item.players} players</Text>
                        </View>
                        <TouchableOpacity style={styles.gameListPlay}>
                            <Text style={styles.gameListPlayText}>Play</Text>
                        </TouchableOpacity>
                    </View>
                )}
                contentContainerStyle={styles.gameListContainer}
            />
        </SafeAreaView>
    );
};

const SocialScreen = () => {
    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#05050a" />
            <View style={styles.header}>
                <Text style={styles.logo}>👥 <Text style={{color:'#7c3aed'}}>Social</Text></Text>
            </View>
            <View style={styles.socialCard}>
                <Text style={styles.socialTitle}>Friends Online</Text>
                <View style={styles.friendList}>
                    {['🧙 GameMaster', '🦸 Heroic', '🧝 Shadow', '🤖 Bot_AI'].map((friend, i) => (
                        <View key={i} style={styles.friendItem}>
                            <Text style={styles.friendAvatar}>{friend.split(' ')[0]}</Text>
                            <Text style={styles.friendName}>{friend.split(' ')[1]}</Text>
                            <View style={[styles.statusDot, styles.statusOnline]} />
                        </View>
                    ))}
                </View>
            </View>
            <View style={styles.socialCard}>
                <Text style={styles.socialTitle}>💬 Recent Messages</Text>
                <View style={styles.messageItem}>
                    <Text style={styles.messageSender}>GameMaster:</Text>
                    <Text style={styles.messageText}>Game starting in 5 minutes!</Text>
                </View>
                <View style={styles.messageItem}>
                    <Text style={styles.messageSender}>Heroic:</Text>
                    <Text style={styles.messageText}>I'm in! Let's do this!</Text>
                </View>
            </View>
        </SafeAreaView>
    );
};

const ProfileScreen = () => {
    const [user] = useState<User>(mockUser);
    const [wallet] = useState<Wallet>(mockWallet);

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#05050a" />
            <View style={styles.header}>
                <Text style={styles.logo}>👤 <Text style={{color:'#7c3aed'}}>Profile</Text></Text>
            </View>
            <View style={styles.profileCard}>
                <Text style={styles.profileAvatar}>{user.avatarUrl}</Text>
                <Text style={styles.profileName}>{user.displayName}</Text>
                <Text style={styles.profileUsername}>@{user.username}</Text>
                <View style={styles.profileStatus}>
                    <View style={[styles.statusDot, styles.statusOnline]} />
                    <Text style={styles.profileStatusText}>Online</Text>
                </View>
            </View>
            <View style={styles.profileStats}>
                <View style={styles.profileStat}>
                    <Text style={styles.profileStatValue}>{wallet.softBalance}</Text>
                    <Text style={styles.profileStatLabel}>Coins</Text>
                </View>
                <View style={styles.profileStat}>
                    <Text style={styles.profileStatValue}>{wallet.premiumBalance}</Text>
                    <Text style={styles.profileStatLabel}>Gems</Text>
                </View>
                <View style={styles.profileStat}>
                    <Text style={styles.profileStatValue}>15</Text>
                    <Text style={styles.profileStatLabel}>Games</Text>
                </View>
                <View style={styles.profileStat}>
                    <Text style={styles.profileStatValue}>8</Text>
                    <Text style={styles.profileStatLabel}>Friends</Text>
                </View>
            </View>
            <TouchableOpacity style={styles.profileButton}>
                <Text style={styles.profileButtonText}>✏️ Edit Profile</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.profileButton, styles.profileButtonLogout]}>
                <Text style={[styles.profileButtonText, styles.profileButtonTextLogout]}>🚪 Logout</Text>
            </TouchableOpacity>
        </SafeAreaView>
    );
};

const GameScreen = ({ route }: any) => {
    const { gameId } = route.params || { gameId: 'obstacle_rush' };
    const game = mockGames.find(g => g.id === gameId) || mockGames[0];

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#05050a" />
            <View style={styles.gameScreen}>
                <Text style={styles.gameScreenIcon}>{game.icon}</Text>
                <Text style={styles.gameScreenName}>{game.name}</Text>
                <Text style={styles.gameScreenDesc}>👤 {game.players} players online</Text>
                <TouchableOpacity style={styles.gameScreenPlay}>
                    <Text style={styles.gameScreenPlayText}>▶ Play Now</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.gameScreenBack} onPress={() => {}}>
                    <Text style={styles.gameScreenBackText}>← Back</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};

// ============================================================
// APP
// ============================================================

export default function App() {
    const [currentScreen, setCurrentScreen] = useState('Home');

    const renderScreen = () => {
        switch (currentScreen) {
            case 'Home':
                return <HomeScreen navigation={{ navigate: (screen: string) => setCurrentScreen(screen) }} />;
            case 'Games':
                return <GamesScreen />;
            case 'Social':
                return <SocialScreen />;
            case 'Profile':
                return <ProfileScreen />;
            case 'Game':
                return <GameScreen route={{ params: { gameId: 'obstacle_rush' } }} />;
            default:
                return <HomeScreen navigation={{ navigate: (screen: string) => setCurrentScreen(screen) }} />;
        }
    };

    return renderScreen();
}

// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#05050a',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 12,
    },
    logo: {
        fontSize: 22,
        fontWeight: '700',
        color: '#e0e0e0',
    },
    avatarButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#1a1a2e',
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarEmoji: {
        fontSize: 20,
    },
    walletCard: {
        margin: 16,
        padding: 20,
        backgroundColor: '#0f0f1a',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#1a1a2e',
    },
    walletTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#7c3aed',
        marginBottom: 12,
    },
    walletRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    walletLabel: {
        fontSize: 12,
        color: '#666',
        textAlign: 'center',
    },
    walletValue: {
        fontSize: 24,
        fontWeight: '700',
        color: '#e0e0e0',
        textAlign: 'center',
        marginTop: 4,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#e0e0e0',
    },
    seeAll: {
        fontSize: 13,
        color: '#7c3aed',
    },
    gamesList: {
        paddingHorizontal: 16,
        paddingBottom: 8,
    },
    gameCard: {
        width: 140,
        padding: 16,
        backgroundColor: '#0f0f1a',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#1a1a2e',
        marginRight: 12,
        alignItems: 'center',
    },
    gameIcon: {
        fontSize: 40,
        marginBottom: 8,
    },
    gameName: {
        fontSize: 14,
        fontWeight: '600',
        color: '#e0e0e0',
    },
    gameMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 6,
        gap: 8,
    },
    gamePlayers: {
        fontSize: 12,
        color: '#666',
    },
    gameTag: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
    },
    tag_hot: {
        backgroundColor: '#7f1d1d',
    },
    tag_new: {
        backgroundColor: '#1e3a5f',
    },
    tag_popular: {
        backgroundColor: '#78350f',
    },
    gameTagText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#fff',
    },
    leaderboardItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#0f0f1a',
    },
    leaderboardRank: {
        fontSize: 14,
        fontWeight: '700',
        color: '#7c3aed',
        width: 40,
    },
    leaderboardName: {
        flex: 1,
        fontSize: 14,
        color: '#e0e0e0',
    },
    leaderboardScore: {
        fontSize: 14,
        fontWeight: '600',
        color: '#34d399',
    },
    bottomNav: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingVertical: 12,
        borderTopWidth: 1,
        borderTopColor: '#1a1a2e',
        backgroundColor: '#0a0a12',
        marginTop: 'auto',
    },
    navItem: {
        alignItems: 'center',
    },
    navIcon: {
        fontSize: 22,
    },
    navLabel: {
        fontSize: 11,
        color: '#666',
        marginTop: 2,
    },
    gameListItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#0f0f1a',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#1a1a2e',
        marginHorizontal: 16,
        marginBottom: 12,
    },
    gameListIcon: {
        fontSize: 32,
        marginRight: 16,
    },
    gameListInfo: {
        flex: 1,
    },
    gameListName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#e0e0e0',
    },
    gameListPlayers: {
        fontSize: 13,
        color: '#666',
    },
    gameListPlay: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: '#7c3aed',
        borderRadius: 8,
    },
    gameListPlayText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#fff',
    },
    gameListContainer: {
        paddingTop: 8,
        paddingBottom: 20,
    },
    socialCard: {
        margin: 16,
        padding: 20,
        backgroundColor: '#0f0f1a',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#1a1a2e',
    },
    socialTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#e0e0e0',
        marginBottom: 12,
    },
    friendList: {
        gap: 12,
    },
    friendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#1a1a2e',
    },
    friendAvatar: {
        fontSize: 24,
        marginRight: 12,
    },
    friendName: {
        flex: 1,
        fontSize: 14,
        color: '#e0e0e0',
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    statusOnline: {
        backgroundColor: '#34d399',
    },
    messageItem: {
        flexDirection: 'row',
        paddingVertical: 6,
    },
    messageSender: {
        fontSize: 14,
        fontWeight: '600',
        color: '#7c3aed',
        marginRight: 8,
    },
    messageText: {
        fontSize: 14,
        color: '#999',
    },
    profileCard: {
        alignItems: 'center',
        padding: 24,
        margin: 16,
        backgroundColor: '#0f0f1a',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#1a1a2e',
    },
    profileAvatar: {
        fontSize: 64,
        marginBottom: 12,
    },
    profileName: {
        fontSize: 22,
        fontWeight: '700',
        color: '#e0e0e0',
    },
    profileUsername: {
        fontSize: 14,
        color: '#666',
        marginTop: 4,
    },
    profileStatus: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
        gap: 8,
    },
    profileStatusText: {
        fontSize: 13,
        color: '#34d399',
    },
    profileStats: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginHorizontal: 16,
        padding: 16,
        backgroundColor: '#0f0f1a',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#1a1a2e',
    },
    profileStat: {
        alignItems: 'center',
    },
    profileStatValue: {
        fontSize: 20,
        fontWeight: '700',
        color: '#e0e0e0',
    },
    profileStatLabel: {
        fontSize: 12,
        color: '#666',
        marginTop: 4,
    },
    profileButton: {
        margin: 16,
        padding: 14,
        backgroundColor: '#7c3aed',
        borderRadius: 12,
        alignItems: 'center',
    },
    profileButtonLogout: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: '#7f1d1d',
    },
    profileButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
    profileButtonTextLogout: {
        color: '#f87171',
    },
    gameScreen: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    gameScreenIcon: {
        fontSize: 80,
        marginBottom: 16,
    },
    gameScreenName: {
        fontSize: 28,
        fontWeight: '700',
        color: '#e0e0e0',
    },
    gameScreenDesc: {
        fontSize: 16,
        color: '#666',
        marginTop: 8,
    },
    gameScreenPlay: {
        marginTop: 24,
        paddingHorizontal: 40,
        paddingVertical: 16,
        backgroundColor: '#7c3aed',
        borderRadius: 12,
    },
    gameScreenPlayText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#fff',
    },
    gameScreenBack: {
        marginTop: 16,
    },
    gameScreenBackText: {
        fontSize: 16,
        color: '#666',
    },
});
