import React from 'react';
import { Slot } from 'expo-router';
import { useFonts } from 'expo-font';
import { HankenGrotesk_400Regular } from '@expo-google-fonts/hanken-grotesk/400Regular';
import { HankenGrotesk_600SemiBold } from '@expo-google-fonts/hanken-grotesk/600SemiBold';
import { LibreCaslonDisplay_400Regular } from '@expo-google-fonts/libre-caslon-display/400Regular';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { HostProvider } from '../host';
import { styles } from '../ui';
export default function Layout() {
  // A font that can't load must never keep someone out of the app: show it with the system font.
  const [loaded, failed] = useFonts({ HankenGrotesk_400Regular, HankenGrotesk_600SemiBold, LibreCaslonDisplay_400Regular });
  return <SafeAreaProvider><SafeAreaView style={styles.page}><StatusBar style="dark" />{(loaded || failed) && <HostProvider><Slot /></HostProvider>}</SafeAreaView></SafeAreaProvider>;
}
