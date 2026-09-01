// LNBQSHA Mobile Admin — React Native
// Admin dashboard for iOS & Android

import React, { useState, useEffect } from 'react';
import {
    SafeAreaView,
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    ScrollView,
    FlatList,
    StatusBar,
    RefreshControl,
} from 'react-native';

// ============================================================
// TYPES
// ============================================================

interface AdminStats {
    totalUsers: number;
    onlineUsers: number;
    activeGames: number;
    totalRevenue: number;
    newUsersToday: number;
    activeTournaments: number;
    totalMods: number;
    reportsPending: number;
}

interface RecentActivity {
    id: string;
    type: 'user_joined' | 'game_played' | 'tournament_created' | 'report_filed' | 'purchase_made';
    user: string;
    details: string;
    time: string;
}

interface ServerStatus {
    status: 'online' | 'degraded' | 'offline';
    uptime: string;
    cpu: number;
    memory: number;
    connections: number;
}

// ============================================================
// MOCK DATA
// ============================================================

const mockStats: AdminStats = {
    totalUsers: 15423,
    onlineUsers: 2341,
    activeGames: 567,
    totalRevenue: 45231,
    newUsersToday: 234,
    activeTournaments: 12,
    totalMods: 8,
    reportsPending: 3,
};

const mockActivities: RecentActivity[] = [
    { id: '1', type: 'user_joined', user: 'PlayerOne', details: 'New user registered', time: '2m ago' },
    { id: '2', type: 'game_played', user: 'GameMaster', details: 'Completed Obstacle Rush', time: '5m ago' },
    { id: '3', type: 'tournament_created', user: 'Admin', details: 'Created Weekly Tournament', time: '10m ago' },
    { id: '4', type: 'report_filed', user: 'Shadow', details: 'Reported spam in chat', time: '15m ago' },
    { id: '5', type: 'purchase_made', user: 'Heroic', details: 'Purchased Season Pass', time: '20m ago' },
    { id: '6', type: 'user_joined', user: 'NeonRider', details: 'New user registered', time: '25m ago' },
];

const mockServerStatus: ServerStatus = {
    status: 'online',
    uptime: '12h 34m',
    cpu: 34,
    memory: 56,
    connections: 2341,
};

// ============================================================
// COMPONENTS
// ============================================================

const StatCard = ({ icon, label, value, color }: any) => (
    <View style={[styles.statCard, { borderColor: color || '#7c3aed' }]}>
        <Text style={styles.statIcon}>{icon}</Text>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
    </View>
);

const ActivityItem = ({ item }: { item: RecentActivity }) => {
    const getIcon = () => {
        switch (item.type) {
            case 'user_joined': return '👤';
            case 'game_played': return '🎮';
            case 'tournament_created': return '🏆';
            case 'report_filed': return '🚨';
            case 'purchase_made': return '💰';
            default: return '📌';
        }
    };

    return (
        <View style={styles.activityItem}>
            <Text style={styles.activityIcon}>{getIcon()}</Text>
            <View style={styles.activityInfo}>
                <Text style={styles.activityUser}>{item.user}</Text>
                <Text style={styles.activityDetails}>{item.details}</Text>
            </View>
            <Text style={styles.activityTime}>{item.time}</Text>
        </View>
    );
};

const ServerStatusCard = ({ status }: { status: ServerStatus }) => {
    const getStatusColor = () => {
        switch (status.status) {
            case 'online': return '#34d399';
            case 'degraded': return '#fbbf24';
            case 'offline': return '#f87171';
            default: return '#666';
        }
    };

    return (
        <View style={styles.serverCard}>
            <Text style={styles.serverTitle}>🖥️ Server Status</Text>
            <View style={styles.serverRow}>
                <View style={styles.serverStatus}>
                    <View style={[styles.serverDot, { backgroundColor: getStatusColor() }]} />
                    <Text style={styles.serverStatusText}>{status.status.toUpperCase()}</Text>
                </View>
                <Text style={styles.serverUptime}>⏱️ {status.uptime}</Text>
            </View>
            <View style={styles.serverMetrics}>
                <View style={styles.serverMetric}>
                    <Text style={styles.serverMetricLabel}>CPU</Text>
                    <Text style={styles.serverMetricValue}>{status.cpu}%</Text>
                </View>
                <View style={styles.serverMetric}>
                    <Text style={styles.serverMetricLabel}>Memory</Text>
                    <Text style={styles.serverMetricValue}>{status.memory}%</Text>
                </View>
                <View style={styles.serverMetric}>
                    <Text style={styles.serverMetricLabel}>Connections</Text>
                    <Text style={styles.serverMetricValue}>{status.connections}</Text>
                </View>
            </View>
        </View>
    );
};

// ============================================================
// MAIN SCREEN
// ============================================================

const AdminDashboard = () => {
    const [stats] = useState<AdminStats>(mockStats);
    const [activities] = useState<RecentActivity[]>(mockActivities);
    const [serverStatus] = useState<ServerStatus>(mockServerStatus);
    const [refreshing, setRefreshing] = useState(false);

    const onRefresh = () => {
        setRefreshing(true);
        setTimeout(() => setRefreshing(false), 1000);
    };

    const renderStatCard = (icon: string, label: string, value: number | string, color?: string) => (
        <StatCard icon={icon} label={label} value={value} color={color} />
    );

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#05050a" />

            <View style={styles.header}>
                <Text style={styles.logo}>📊 <Text style={{color:'#7c3aed'}}>Admin</Text></Text>
                <TouchableOpacity style={styles.profileButton}>
                    <Text style={styles.profileEmoji}>👤</Text>
                </TouchableOpacity>
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#7c3aed" />
                }
            >
                {/* Stats Grid */}
                <View style={styles.statsGrid}>
                    {renderStatCard('👥', 'Total Users', stats.totalUsers.toLocaleString())}
                    {renderStatCard('🟢', 'Online', stats.onlineUsers.toLocaleString(), '#34d399')}
                    {renderStatCard('🎮', 'Active Games', stats.activeGames.toLocaleString(), '#60a5fa')}
                    {renderStatCard('💰', 'Revenue', `$${stats.totalRevenue.toLocaleString()}`, '#fbbf24')}
                    {renderStatCard('🆕', 'New Today', stats.newUsersToday.toLocaleString(), '#a78bfa')}
                    {renderStatCard('🏆', 'Tournaments', stats.activeTournaments.toLocaleString(), '#f472b6')}
                    {renderStatCard('🛡️', 'Mods', stats.totalMods.toLocaleString(), '#34d399')}
                    {renderStatCard('🚨', 'Reports', stats.reportsPending.toLocaleString(), '#f87171')}
                </View>

                {/* Server Status */}
                <ServerStatusCard status={serverStatus} />

                {/* Recent Activities */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>📋 Recent Activity</Text>
                        <TouchableOpacity>
                            <Text style={styles.seeAll}>See All</Text>
                        </TouchableOpacity>
                    </View>
                    {activities.map((item) => (
                        <ActivityItem key={item.id} item={item} />
                    ))}
                </View>

                {/* Quick Actions */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>⚡ Quick Actions</Text>
                    <View style={styles.quickActions}>
                        <TouchableOpacity style={styles.quickAction}>
                            <Text style={styles.quickActionIcon}>👥</Text>
                            <Text style={styles.quickActionLabel}>Users</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.quickAction}>
                            <Text style={styles.quickActionIcon}>🎮</Text>
                            <Text style={styles.quickActionLabel}>Games</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.quickAction}>
                            <Text style={styles.quickActionIcon}>🏆</Text>
                            <Text style={styles.quickActionLabel}>Tournaments</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.quickAction}>
                            <Text style={styles.quickActionIcon}>📝</Text>
                            <Text style={styles.quickActionLabel}>Reports</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.quickAction}>
                            <Text style={styles.quickActionIcon}>💰</Text>
                            <Text style={styles.quickActionLabel}>Economy</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.quickAction}>
                            <Text style={styles.quickActionIcon}>⚙️</Text>
                            <Text style={styles.quickActionLabel}>Settings</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={styles.footer}>
                    <Text style={styles.footerText}>LNBQSHA Admin v1.0.0</Text>
                    <Text style={styles.footerSub}>© 2026 LNBQSHA</Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

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
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#1a1a2e',
    },
    logo: {
        fontSize: 22,
        fontWeight: '700',
        color: '#e0e0e0',
    },
    profileButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#1a1a2e',
        justifyContent: 'center',
        alignItems: 'center',
    },
    profileEmoji: {
        fontSize: 20,
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        padding: 12,
        gap: 12,
    },
    statCard: {
        flex: 1,
        minWidth: '40%',
        maxWidth: '48%',
        backgroundColor: '#0f0f1a',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: '#1a1a2e',
        alignItems: 'center',
    },
    statIcon: {
        fontSize: 24,
        marginBottom: 4,
    },
    statValue: {
        fontSize: 20,
        fontWeight: '700',
        color: '#e0e0e0',
    },
    statLabel: {
        fontSize: 12,
        color: '#666',
        marginTop: 2,
    },
    serverCard: {
        margin: 12,
        padding: 20,
        backgroundColor: '#0f0f1a',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#1a1a2e',
    },
    serverTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#e0e0e0',
        marginBottom: 12,
    },
    serverRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    serverStatus: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    serverDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    serverStatusText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#e0e0e0',
    },
    serverUptime: {
        fontSize: 14,
        color: '#666',
    },
    serverMetrics: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#1a1a2e',
    },
    serverMetric: {
        alignItems: 'center',
    },
    serverMetricLabel: {
        fontSize: 12,
        color: '#666',
    },
    serverMetricValue: {
        fontSize: 16,
        fontWeight: '600',
        color: '#e0e0e0',
    },
    section: {
        margin: 12,
        padding: 16,
        backgroundColor: '#0f0f1a',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#1a1a2e',
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#e0e0e0',
        marginBottom: 12,
    },
    seeAll: {
        fontSize: 13,
        color: '#7c3aed',
    },
    activityItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#1a1a2e',
    },
    activityIcon: {
        fontSize: 20,
        marginRight: 12,
    },
    activityInfo: {
        flex: 1,
    },
    activityUser: {
        fontSize: 14,
        fontWeight: '600',
        color: '#e0e0e0',
    },
    activityDetails: {
        fontSize: 13,
        color: '#666',
    },
    activityTime: {
        fontSize: 12,
        color: '#444',
    },
    quickActions: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    quickAction: {
        flex: 1,
        minWidth: '28%',
        maxWidth: '30%',
        alignItems: 'center',
        padding: 12,
        backgroundColor: '#1a1a2e',
        borderRadius: 12,
    },
    quickActionIcon: {
        fontSize: 24,
        marginBottom: 4,
    },
    quickActionLabel: {
        fontSize: 12,
        color: '#666',
    },
    footer: {
        alignItems: 'center',
        paddingVertical: 24,
    },
    footerText: {
        fontSize: 14,
        color: '#444',
    },
    footerSub: {
        fontSize: 12,
        color: '#333',
        marginTop: 4,
    },
});

// ============================================================
// EXPORT
// ============================================================

export default AdminDashboard;
