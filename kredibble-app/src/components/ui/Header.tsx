import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { Colors } from "../../constants/design";

export interface HeaderProps {
  title?: string;
  showBack?: boolean;
  rightComponent?: React.ReactNode;
  onBackPress?: () => void;
}

export function Header({
  title,
  showBack = false,
  rightComponent,
  onBackPress,
}: HeaderProps) {
  const router = useRouter();

  const handleBack = () => {
    if (onBackPress) {
      onBackPress();
    } else if (router.canGoBack()) {
      router.back();
    }
  };

  return (
    <View className="flex-row items-center justify-between h-14 px-4 bg-transparent mt-2">
      <View className="flex-1 items-start">
        {showBack && (
          <TouchableOpacity
            onPress={handleBack}
            className="w-10 h-10 items-center justify-center bg-white rounded-full border border-border"
          >
            <ChevronLeft size={24} color={Colors.textHeading} />
          </TouchableOpacity>
        )}
      </View>
      
      <View className="flex-[2] items-center">
        {title && (
          <Text className="text-lg font-heading font-semibold text-text text-center">
            {title}
          </Text>
        )}
      </View>

      <View className="flex-1 items-end justify-center">
        {rightComponent}
      </View>
    </View>
  );
}
