import React from 'react';
import { Slot } from 'expo-router';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { HostProvider } from '../host';
import { styles } from '../ui';
export default function Layout() { return <SafeAreaProvider><SafeAreaView style={styles.page}><StatusBar style="dark" /><HostProvider><Slot /></HostProvider></SafeAreaView></SafeAreaProvider>; }
