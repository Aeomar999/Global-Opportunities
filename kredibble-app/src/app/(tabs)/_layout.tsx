import { useState, useEffect } from 'react';
import { View, Platform } from 'react-native';
import { Tabs, useGlobalSearchParams } from 'expo-router';
import { PlusCircle } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { authStore } from '../../constants/authStore';
import { Colors, Size } from '../../constants/design';
import { NavHome, NavDiscover, NavGoals, NavCommunity, NavProfile } from '../../components/ui/NavIcons';

const TabIcon = ({ Icon, focused }: { Icon: any; focused: boolean }) => (
  <View style={{
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: Platform.OS === 'ios' ? 4 : 0,
  }}>
    {Icon.isNavIcon ? (
      // Supplied artwork: white outline when inactive, solid orange when active
      <Icon size={Size.tabIconSize} focused={focused} />
    ) : (
      <Icon size={Size.tabIconSize} color={focused ? Colors.tabIconActive : Colors.tabIcon} />
    )}
    <View
      style={{
        width: Size.tabIndicatorW,
        height: Size.tabIndicatorH,
        backgroundColor: focused ? Colors.tabIndicator : 'transparent',
        borderRadius: Size.tabIndicatorH / 2,
        marginTop: 8,
      }}
    />
  </View>
);

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const TAB_PAD_TOP = 10;
  const TAB_BAR_HEIGHT = (Platform.OS === 'ios' ? 49 + insets.bottom : Size.tabBarHeight) + TAB_PAD_TOP;
  const [role, setRole] = useState(authStore.role);
  const params = useGlobalSearchParams();
  const viewMode = params.view;

  useEffect(() => {
    return authStore.subscribe(() => {
      setRole(authStore.role);
    });
  }, []);

  const commonOptions = {
    headerShown: false,
    tabBarShowLabel: false,
    tabBarStyle: {
      backgroundColor: Colors.tabBar,
      // Flat bar: no top border and no shadow (matches the approved design)
      borderTopWidth: 0,
      elevation: 0,
      shadowOpacity: 0,
      height: TAB_BAR_HEIGHT,
      paddingTop: TAB_PAD_TOP,
      paddingBottom: Platform.OS === 'ios' ? insets.bottom : 0,
    },
    tabBarActiveTintColor: Colors.tabIcon,
    tabBarInactiveTintColor: Colors.tabIcon,
  };

  if (role === 'hirer') {
    return (
      <Tabs screenOptions={commonOptions}>
        <Tabs.Screen
          name="index"
          options={{ tabBarIcon: ({ focused }) => <TabIcon Icon={NavHome} focused={focused} /> }}
        />
        <Tabs.Screen
          name="career"
          options={{ tabBarIcon: ({ focused }) => <TabIcon Icon={NavGoals} focused={focused} /> }}
        />
        <Tabs.Screen
          name="opportunities"
          listeners={({ navigation }) => ({
            tabPress: (e) => {
              e.preventDefault();
              navigation.navigate('opportunities', { view: undefined });
            },
          })}
          options={{ tabBarIcon: ({ focused }) => <TabIcon Icon={PlusCircle} focused={viewMode === 'all' ? false : focused} /> }}
        />
        <Tabs.Screen
          name="community"
          options={{ tabBarIcon: ({ focused }) => <TabIcon Icon={NavCommunity} focused={focused} /> }}
        />
        <Tabs.Screen
          name="profile"
          options={{ tabBarIcon: ({ focused }) => <TabIcon Icon={NavProfile} focused={focused} /> }}
        />
      </Tabs>
    );
  }

  // Seeker role (Find Opportunities)
  return (
    <Tabs screenOptions={commonOptions}>
      <Tabs.Screen
        name="index"
        options={{ tabBarIcon: ({ focused }) => <TabIcon Icon={NavHome} focused={focused} /> }}
      />
      <Tabs.Screen
        name="opportunities"
        options={{ tabBarIcon: ({ focused }) => <TabIcon Icon={NavDiscover} focused={focused} /> }}
      />
      <Tabs.Screen
        name="career"
        options={{ tabBarIcon: ({ focused }) => <TabIcon Icon={NavGoals} focused={focused} /> }}
      />
      <Tabs.Screen
        name="community"
        options={{ tabBarIcon: ({ focused }) => <TabIcon Icon={NavCommunity} focused={focused} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ tabBarIcon: ({ focused }) => <TabIcon Icon={NavProfile} focused={focused} /> }}
      />
    </Tabs>
  );
}
