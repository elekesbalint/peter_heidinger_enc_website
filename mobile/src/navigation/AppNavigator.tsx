import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { LinearGradient } from 'expo-linear-gradient';

import { supabase } from '../lib/supabase';
import { signOut } from '../lib/auth';
import { Colors, Gradients, Fonts, Radius } from '../theme';
import { Text } from '../components/ui';

import { LoginScreen } from '../screens/auth/LoginScreen';
import { RegisterScreen } from '../screens/auth/RegisterScreen';
import { ForgotPasswordScreen } from '../screens/auth/ForgotPasswordScreen';
import { DashboardScreen } from '../screens/main/DashboardScreen';
import { OrderScreen } from '../screens/main/OrderScreen';
import { TopupScreen } from '../screens/main/TopupScreen';
import { ProfileScreen } from '../screens/main/ProfileScreen';
import { BlogScreen } from '../screens/secondary/BlogScreen';
import { ContactScreen } from '../screens/secondary/ContactScreen';
import { LegalScreen } from '../screens/secondary/LegalScreen';
import { SuccessScreen, CancelScreen } from '../screens/secondary/SuccessCancelScreens';

import type {
  AuthStackParamList,
  MainTabParamList,
  HomeStackParamList,
  OrderStackParamList,
  TopupStackParamList,
  ProfileStackParamList,
} from './types';

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();
const HomeStack = createNativeStackNavigator<HomeStackParamList>();
const OrderStack = createNativeStackNavigator<OrderStackParamList>();
const TopupStack = createNativeStackNavigator<TopupStackParamList>();
const ProfileStack = createNativeStackNavigator<ProfileStackParamList>();

const SCREEN_OPTIONS = {
  headerStyle: { backgroundColor: Colors.bg },
  headerTintColor: Colors.textPrimary,
  headerTitleStyle: { fontWeight: Fonts.weights.semibold, color: Colors.textPrimary },
  headerShadowVisible: false,
  contentStyle: { backgroundColor: Colors.bg },
};

// Stable component references to avoid inline function warnings from React Navigation
function AszfScreen() { return <LegalScreen type="aszf" />; }
function AdatvedelemScreen() { return <LegalScreen type="adatvedelem" />; }
function DevicePlaceholderScreen() {
  return <View style={{ flex: 1, backgroundColor: Colors.bg }} />;
}

function HomeStackNavigator() {
  return (
    <HomeStack.Navigator screenOptions={SCREEN_OPTIONS}>
      <HomeStack.Screen name="Dashboard" component={DashboardScreen} options={{ headerShown: false }} />
      <HomeStack.Screen name="BlogList" component={BlogScreen} options={{ title: 'Hírek & Blog' }} />
      <HomeStack.Screen
        name="BlogDetail"
        options={({ route }) => ({ title: route.params.title })}
        component={AszfScreen}
      />
      <HomeStack.Screen name="Contact" component={ContactScreen} options={{ title: 'Kapcsolat' }} />
      <HomeStack.Screen name="Aszf" component={AszfScreen} options={{ title: 'ÁSZF' }} />
      <HomeStack.Screen name="Adatvedelem" component={AdatvedelemScreen} options={{ title: 'Adatvédelem' }} />
      <HomeStack.Screen name="DeviceDetail" component={DevicePlaceholderScreen} options={{ title: 'Eszköz' }} />
    </HomeStack.Navigator>
  );
}

function OrderStackNavigator() {
  return (
    <OrderStack.Navigator screenOptions={SCREEN_OPTIONS}>
      <OrderStack.Screen name="Order" component={OrderScreen} options={{ headerShown: false }} />
      <OrderStack.Screen name="OrderSuccess" options={{ headerShown: false }}>
        {({ navigation }) => (
          <SuccessScreen
            title="Rendelés sikeres!"
            subtitle="Hamarosan feldolgozzuk rendelését és értesítjük."
            onContinue={() => navigation.getParent()?.navigate('HomeTab')}
            continueLabel="Fiókom"
          />
        )}
      </OrderStack.Screen>
      <OrderStack.Screen name="OrderCancel" options={{ headerShown: false }}>
        {({ navigation }) => (
          <CancelScreen onBack={() => navigation.goBack()} />
        )}
      </OrderStack.Screen>
    </OrderStack.Navigator>
  );
}

function TopupStackNavigator() {
  return (
    <TopupStack.Navigator screenOptions={SCREEN_OPTIONS}>
      <TopupStack.Screen name="Topup" component={TopupScreen} options={{ headerShown: false }} />
      <TopupStack.Screen name="TopupSuccess" options={{ headerShown: false }}>
        {({ navigation }) => (
          <SuccessScreen
            title="Feltöltés sikeres!"
            subtitle="Egyenlege hamarosan frissül."
            onContinue={() => navigation.getParent()?.navigate('HomeTab')}
            continueLabel="Fiókom"
          />
        )}
      </TopupStack.Screen>
      <TopupStack.Screen name="TopupCancel" options={{ headerShown: false }}>
        {({ navigation }) => (
          <CancelScreen onBack={() => navigation.goBack()} />
        )}
      </TopupStack.Screen>
    </TopupStack.Navigator>
  );
}

function ProfileStackNavigator() {
  return (
    <ProfileStack.Navigator screenOptions={SCREEN_OPTIONS}>
      <ProfileStack.Screen name="Profile" component={ProfileScreen} options={{ headerShown: false }} />
      <ProfileStack.Screen name="Aszf" component={AszfScreen} options={{ title: 'ÁSZF' }} />
      <ProfileStack.Screen name="Adatvedelem" component={AdatvedelemScreen} options={{ title: 'Adatvédelem' }} />
      <ProfileStack.Screen name="Contact" component={ContactScreen} options={{ title: 'Kapcsolat' }} />
    </ProfileStack.Navigator>
  );
}

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: focused ? 22 : 20, opacity: focused ? 1 : 0.5 }}>{emoji}</Text>
    </View>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.bgCard,
          borderTopColor: Colors.border,
          borderTopWidth: 1,
          paddingBottom: 6,
          paddingTop: 6,
          height: 60,
        },
        tabBarActiveTintColor: Colors.accent,
        tabBarInactiveTintColor: Colors.textTertiary,
        tabBarLabelStyle: { fontSize: Fonts.sizes.xs, fontWeight: Fonts.weights.medium },
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeStackNavigator}
        options={{
          title: 'Fiókom',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="OrderTab"
        component={OrderStackNavigator}
        options={{
          title: 'Rendelés',
          tabBarIcon: ({ focused }) => <TabIcon emoji="📦" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="TopupTab"
        component={TopupStackNavigator}
        options={{
          title: 'Feltöltés',
          tabBarIcon: ({ focused }) => <TabIcon emoji="💳" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileStackNavigator}
        options={{
          title: 'Profil',
          tabBarIcon: ({ focused }) => <TabIcon emoji="👤" focused={focused} />,
        }}
      />
    </Tab.Navigator>
  );
}

function AuthStackNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
      <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
    </AuthStack.Navigator>
  );
}

export function AppNavigator() {
  const [session, setSession] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Egyszeri kényszerített kijelentkezés: .env-ben EXPO_PUBLIC_FORCE_LOGOUT_ONCE=1, majd egy indítás után töröld a sort.
        if (process.env.EXPO_PUBLIC_FORCE_LOGOUT_ONCE === '1') {
          await signOut();
        }
        const { data } = await supabase.auth.getSession();
        if (!cancelled) setSession(!!data.session);
      } catch {
        if (!cancelled) setSession(false);
      }
    })();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(!!s);
    });
    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, []);

  if (session === null) {
    return (
      <LinearGradient colors={Gradients.bg} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={Colors.accent} size="large" />
      </LinearGradient>
    );
  }

  return (
    <NavigationContainer>
      {session ? <MainTabs /> : <AuthStackNavigator />}
    </NavigationContainer>
  );
}
