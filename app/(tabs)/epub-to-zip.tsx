import EpubToZipConverter from '@/EpubConveter/EpubToZipConverter';
import { useColorScheme } from '@/hooks/use-color-scheme';
import React from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';

export default function EpubToZipScreen() {
    const dark = useColorScheme() === 'dark';

    return (
        <SafeAreaView style={[styles.root, dark && styles.rootDark]}>
            <EpubToZipConverter />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: '#f1f5f9',
    },
    rootDark: {
        backgroundColor: '#0f172a',
    },
});
