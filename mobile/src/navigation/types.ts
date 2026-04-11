import type { NavigatorScreenParams } from '@react-navigation/native';

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
};

export type OnboardingStackParamList = {
  Onboarding: undefined;
};

export type MainTabParamList = {
  HomeTab: NavigatorScreenParams<HomeStackParamList> | undefined;
  OrderTab: NavigatorScreenParams<OrderStackParamList> | undefined;
  TopupTab: NavigatorScreenParams<TopupStackParamList> | undefined;
  ProfileTab: NavigatorScreenParams<ProfileStackParamList> | undefined;
};

export type HomeStackParamList = {
  Dashboard: undefined;
  DeviceDetail: { identifier: string };
  BlogList: undefined;
  BlogDetail: { slug: string; title: string };
  Contact: undefined;
  Aszf: undefined;
  Adatvedelem: undefined;
};

export type OrderStackParamList = {
  Order: undefined;
  OrderSuccess: { sessionId?: string };
  OrderCancel: undefined;
};

export type TopupStackParamList = {
  Topup: { deviceIdentifier?: string };
  TopupSuccess: { sessionId?: string };
  TopupCancel: undefined;
};

export type ProfileStackParamList = {
  Profile: undefined;
  EditProfile: undefined;
  Referrals: undefined;
  Aszf: undefined;
  Adatvedelem: undefined;
  Contact: undefined;
};
