export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
};

export type MainTabParamList = {
  HomeTab: undefined;
  OrderTab: undefined;
  TopupTab: undefined;
  ProfileTab: undefined;
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
