import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import JSZip from 'jszip';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import generateHtml from './generateHtml';

// Decode base64 → Uint8Array (Hermes-safe)
function base64ToUint8Array(base64: string): Uint8Array {
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export default function EpubToZipConverter() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileUri, setFileUri] = useState<string | null>(null);
  const [converting, setConverting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [done, setDone] = useState(false);

  const reset = () => {
    setFileName(null);
    setFileUri(null);
    setProgress(0);
    setStatus('');
    setDone(false);
  };

  // ── Pick file ──────────────────────────────────────────────────────────────
  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: Platform.OS === 'ios' ? 'public.epub' : '*/*',
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset.name.toLowerCase().endsWith('.epub')) {
        Alert.alert('Invalid file', 'Please select a valid .epub file.');
        return;
      }
      setDone(false);
      setProgress(0);
      setStatus('');
      setFileName(asset.name);
      setFileUri(asset.uri);
    } catch {
      Alert.alert('Error', 'Could not pick file.');
    }
  };

  // ── Convert ────────────────────────────────────────────────────────────────
  const convert = async () => {
    if (!fileUri || !fileName) return;
    setConverting(true);
    setDone(false);
    setProgress(2);
    setStatus('Reading EPUB…');

    try {
      // 1. Read as base64
      const base64 = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      setProgress(10);
      setStatus('Parsing archive…');

      // 2. Load into JSZip
      const uint8 = base64ToUint8Array(base64);
      const zip = await JSZip.loadAsync(uint8.buffer as ArrayBuffer);

      const newZip = new JSZip();
      const entries = Object.entries(zip.files);
      const total = entries.length;
      let done = 0;
      let tocContent = '';
      const pageLinks: string[] = [];

      setStatus('Extracting contents…');

      // 3. Process EPUB files
      for (const [filename, entry] of entries) {
        if (filename.startsWith('EPUB/')) {
          const content = await entry.async('uint8array');
          const imageExts = ['PNG', 'JPG', 'JPEG', 'GIF', 'WEBP', 'BMP'];
          let newName = filename.replace(/^EPUB\//, '');
          const ext = newName.split('.').pop() ?? '';
          if (imageExts.includes(ext.toUpperCase())) {
            newName = newName.replace(/\.[^/.]+$/, `.${ext.toLowerCase()}`);
          }
          newZip.file(newName, content);

          if (filename === 'EPUB/xhtml/raw/contents.xhtml') {
            tocContent = await entry.async('text');
          }
          if (filename.startsWith('EPUB/xhtml/') &&
            (filename.endsWith('.xhtml') || filename.endsWith('.html'))) {
            pageLinks.push(newName);
          }
        }
        done++;
        setProgress(10 + Math.round((done / total) * 40));
      }

      setStatus('Fetching jQuery…');
      setProgress(52);

      // 4. jQuery
      try {
        const jqRes = await fetch('https://code.jquery.com/jquery-3.6.0.min.js');
        newZip.file('jquery.min.js', await jqRes.arrayBuffer());
      } catch {
        newZip.file('jquery.min.js', '/* jQuery unavailable */');
      }

      setStatus('Generating viewer…');
      setProgress(58);

      // 5. HTML viewer
      newZip.file('index.html', generateHtml(pageLinks, tocContent));

      setStatus('Building ZIP…');

      // 6. Generate ZIP
      const zipBase64 = await newZip.generateAsync(
        { type: 'base64' },
        (meta) => setProgress(58 + Math.round(meta.percent * 0.38))
      );

      setProgress(97);
      setStatus('Saving…');

      const outName = fileName.replace(/\.epub$/i, '.zip');
      const outPath = `${FileSystem.cacheDirectory}${outName}`;
      await FileSystem.writeAsStringAsync(outPath, zipBase64, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Share / save via native dialog
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(outPath, {
          mimeType: 'application/zip',
          dialogTitle: `Save ${outName}`,
          UTI: 'public.zip-archive',
        });
      } else {
        Alert.alert('Saved', `ZIP saved to:\n${outPath}`);
      }

      setProgress(100);
      setStatus('');
      setConverting(false);
      setDone(true);
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Conversion failed. Please try again.');
      setConverting(false);
      setProgress(0);
      setStatus('');
    }
  };

  const clamped = Math.min(Math.max(progress, 0), 100);

  return (
    <ScrollView
      contentContainerStyle={styles.root}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerEmoji}>📘</Text>
        <Text style={styles.headerTitle}>EPUB to ZIP</Text>
        <Text style={styles.headerSub}>Select a file and convert instantly</Text>
      </View>

      {/* Picker */}
      <TouchableOpacity
        style={[styles.picker, !!fileName && styles.pickerActive]}
        onPress={pickFile}
        disabled={converting}
        activeOpacity={0.75}
      >
        <Text style={styles.pickerIcon}>{fileName ? '📄' : '📂'}</Text>
        <Text style={[styles.pickerName, !!fileName && styles.pickerNameActive]}>
          {fileName ?? 'Tap to select .epub file'}
        </Text>
        {fileName && (
          <Text style={styles.pickerChange}>Tap to change</Text>
        )}
      </TouchableOpacity>

      {/* Convert button */}
      <TouchableOpacity
        style={[styles.btn, (!fileName || converting) && styles.btnDisabled]}
        onPress={convert}
        disabled={!fileName || converting}
        activeOpacity={0.82}
      >
        {converting
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.btnText}>⚡ Convert &amp; Download</Text>
        }
      </TouchableOpacity>

      {/* Progress */}
      {converting && (
        <View style={styles.progressWrap}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${clamped}%` as any }]} />
          </View>
          <View style={styles.progressRow}>
            <Text style={styles.progressStatus}>{status}</Text>
            <Text style={styles.progressPct}>{clamped}%</Text>
          </View>
        </View>
      )}

      {/* Success */}
      {done && (
        <View style={styles.success}>
          <Text style={styles.successIcon}>✅</Text>
          <View style={styles.successText}>
            <Text style={styles.successTitle}>Download complete!</Text>
            <Text style={styles.successSub}>
              {Platform.OS === 'web'
                ? 'Your ZIP file has been downloaded.'
                : 'Saved to your Documents folder.'}
            </Text>
          </View>
          <TouchableOpacity onPress={reset} style={styles.resetBtn}>
            <Text style={styles.resetText}>New</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const ACCENT = '#6366f1';
const ACCENT_LIGHT = '#818cf8';

const styles = StyleSheet.create({
  root: {
    flexGrow: 1,
    padding: 24,
    paddingTop: 56,
    gap: 16,
  },

  // Header
  header: { alignItems: 'center', marginBottom: 8 },
  headerEmoji: { fontSize: 54, marginBottom: 10 },
  headerTitle: { fontSize: 30, fontWeight: '800', color: '#1e293b', letterSpacing: -0.5 },
  headerSub: { fontSize: 14, color: '#64748b', marginTop: 4 },

  // Picker
  picker: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#cbd5e1',
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    gap: 6,
  },
  pickerActive: { borderColor: ACCENT, backgroundColor: '#eef2ff' },
  pickerIcon: { fontSize: 40, marginBottom: 4 },
  pickerName: { fontSize: 15, fontWeight: '600', color: '#475569', textAlign: 'center' },
  pickerNameActive: { color: ACCENT },
  pickerChange: { fontSize: 12, color: '#94a3b8', marginTop: 2 },

  // Button
  btn: {
    backgroundColor: ACCENT,
    borderRadius: 14,
    paddingVertical: 17,
    alignItems: 'center',
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 7,
  },
  btnDisabled: { backgroundColor: '#a5b4fc', shadowOpacity: 0, elevation: 0 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },

  // Progress
  progressWrap: { gap: 8 },
  progressTrack: { height: 8, backgroundColor: '#e2e8f0', borderRadius: 99, overflow: 'hidden' },
  progressFill: { height: 8, backgroundColor: ACCENT, borderRadius: 99 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between' },
  progressStatus: { fontSize: 13, color: '#64748b' },
  progressPct: { fontSize: 13, fontWeight: '700', color: ACCENT_LIGHT },

  // Success
  success: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    borderRadius: 14,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  successIcon: { fontSize: 28 },
  successText: { flex: 1 },
  successTitle: { fontSize: 15, fontWeight: '700', color: '#166534' },
  successSub: { fontSize: 13, color: '#4ade80', marginTop: 2 },
  resetBtn: {
    backgroundColor: '#dcfce7',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  resetText: { fontSize: 13, fontWeight: '700', color: '#166534' },
});
