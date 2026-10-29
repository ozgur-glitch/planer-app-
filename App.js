import React, { useState, useEffect, useRef, useMemo } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Modal, TextInput, StatusBar, SafeAreaView, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';

// Dynamische Hilfsfunktion zur Generierung von Jahren
const generateDynamicYears = (personKeys, startYear = 2020, endYear = 2030) => {
  const yearData = [];
  const startDate = new Date(startYear, 0, 1);
  const endDate = new Date(endYear, 11, 31);
  const wochentage = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  let idCounter = 1;

  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const tagStr = wochentage[d.getDay()];
    const tag = String(d.getDate()).padStart(2, '0');
    const monat = String(d.getMonth() + 1).padStart(2, '0');
    const jahr = d.getFullYear();
    const datumStr = `${tag}.${monat}.${jahr}`;

    yearData.push({
      id: String(idCounter++),
      tag: tagStr,
      datum: datumStr,
      ...Object.fromEntries(personKeys.map(k => [k, '—'])),
      ...Object.fromEntries(personKeys.map(k => [k + 'Col', 'transparent']))
    });
  }
  return yearData;
};

export default function App() {
  const [activeTab, setActiveTab] = useState('Schichten');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [nameModalVisible, setNameModalVisible] = useState(false);
  const [selectedCell, setSelectedCell] = useState(null);
  const [selectedPersonKey, setSelectedPersonKey] = useState(null);
  const [tempName, setTempName] = useState('');

  const [rangeStartIdx, setRangeStartIdx] = useState(0);
  const [rangeEndIdx, setRangeEndIdx] = useState(0);
  const [rangeModalVisible, setRangeModalVisible] = useState(false);
  const [selectingType, setSelectingType] = useState('start'); 
  const [manualDateText, setManualDateText] = useState('');

  // Zeitraum-Filter per TTMMJJJJ Eingabe
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [filterStartRaw, setFilterStartRaw] = useState('');
  const [filterEndRaw, setFilterEndRaw] = useState('');
  const [activeFilterRange, setActiveFilterRange] = useState(null);

  const filterEndInputRef = useRef(null);

  const [customLabel, setCustomLabel] = useState('');
  const [customColor, setCustomColor] = useState('#D81B60');

  const [copyModeActive, setCopyModeActive] = useState(false);
  const [copiedValue, setCopiedValue] = useState(null);

  const customColorPalette = [
    '#D81B60', '#1E88E5', '#E65100', '#2E7D32', '#6A1B9A', 
    '#F57F17', '#00838F', '#455A64', '#8D6E63', '#EC407A', '#558B2F'
  ];

  const initialNames = { p1: 'P1', p2: 'Paul', p3: 'P3', p4: 'P4', p5: 'P5', p6: 'P6', p7: 'P7', p8: 'P8', p9: 'P9', p10: 'P10' };
  const [personNames, setPersonNames] = useState(initialNames);
  const personKeys = Object.keys(initialNames);
  const monate = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

  const [schichtTypen, setSchichtTypen] = useState([
    {l:'SV',  c:'#C62828', s:'06:00', e:'14:00', p:'30'},
    {l:'PDI', c:'#2E7D32', s:'06:00', e:'14:00', p:'30'},
    {l:'QS',  c:'#EF6C00', s:'07:00', e:'15:30', p:'30'},
    {l:'STL', c:'#1565C0', s:'07:00', e:'15:30', p:'30'},
    {l:'FHR', c:'#6A1B9A', s:'07:00', e:'15:30', p:'30'},
    {l:'FD',  c:'#4A148C', s:'06:00', e:'14:30', p:'30'},
    {l:'SD',  c:'#00838F', s:'13:30', e:'22:00', p:'30'},
    {l:'QC',  c:'#AD1457', s:'07:00', e:'15:30', p:'30'},
    {l:'TS',  c:'#64DD17', s:'07:30', e:'16:00', p:'30'},
    {l:'HRS', c:'#EC407A', s:'08:00', e:'16:30', p:'30'}
  ]);

  const [editingSchichtIdx, setEditingSchichtIdx] = useState(null);
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');
  const [editPauseTime, setEditPauseTime] = useState('');

  const editEndRef = useRef(null);
  const editPauseRef = useRef(null);

  const verticalScrollRef = useRef(null);
  const dateScrollRef = useRef(null);
  const horizontalHeaderRef = useRef(null);

  const formatTimeHHMM = (text, setTimeState, nextFocusRef) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    if (cleaned.length <= 4) {
      if (cleaned.length === 4) {
        const hh = cleaned.substring(0, 2);
        const mm = cleaned.substring(2, 4);
        setTimeState(`${hh}:${mm}`);
        if (nextFocusRef && nextFocusRef.current) {
          nextFocusRef.current.focus();
        }
      } else {
        setTimeState(cleaned);
      }
    }
  };

  const getHessenFeiertage = (jahr) => {
    const f = Math.floor, a = jahr % 19, b = f(jahr / 100), c = jahr % 100,
          d = f(b / 4), e = b % 4, g = f((8 * b + 13) / 25),
          h = (19 * a + b - d - g + 15) % 30, i = f(c / 4), k = c % 4,
          l = (32 + 2 * e + 2 * i - h - k) % 7, m = f((a + 11 * h + 19 * l) / 433),
          n = f((h + l - 7 * m + 90) / 25), p = (h + l - 7 * m + 114) % 31;
    const ostern = new Date(jahr, n - 1, p + 1);
    
    const feiertage = { 
      [`01.01.${jahr}`]: { code: "NJ", name: "Neujahr" }, 
      [`01.05.${jahr}`]: { code: "TdA", name: "Tag der Arbeit" }, 
      [`03.10.${jahr}`]: { code: "TdE", name: "Tag der Deutschen Einheit" }, 
      [`25.12.${jahr}`]: { code: "W1", name: "1. Weihnachtsfeiertag" }, 
      [`26.12.${jahr}`]: { code: "W2", name: "2. Weihnachtsfeiertag" } 
    };
    
    const addDays = (date, days) => {
      const d = new Date(date); d.setDate(d.getDate() + days);
      return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
    };
    
    feiertage[addDays(ostern, -2)] = { code: "KF", name: "Karfreitag" }; 
    feiertage[addDays(ostern, 0)] = { code: "OS", name: "Ostersonntag" }; 
    feiertage[addDays(ostern, 1)] = { code: "OM", name: "Ostermontag" };
    feiertage[addDays(ostern, 39)] = { code: "CH", name: "Christi Himmelfahrt" }; 
    feiertage[addDays(ostern, 50)] = { code: "PM", name: "Pfingstmontag" }; 
    feiertage[addDays(ostern, 60)] = { code: "FL", name: "Fronleichnam" };
    return feiertage;
  };

  const isHessenFeiertag = (datumStr) => {
    const parts = datumStr.split('.');
    if (parts.length < 3) return null;
    const jahr = parseInt(parts[2]);
    const feiertage = getHessenFeiertage(jahr);
    return feiertage[datumStr] ? feiertage[datumStr].code : null;
  };

  const getHessenFeiertagName = (datumStr) => {
    const parts = datumStr.split('.');
    if (parts.length < 3) return null;
    const jahr = parseInt(parts[2]);
    const feiertage = getHessenFeiertage(jahr);
    return feiertage[datumStr] ? feiertage[datumStr].name : null;
  };

  const [shifts, setShifts] = useState(() => generateDynamicYears(Object.keys(initialNames), 2020, 2030));

  useEffect(() => { loadData(); }, []);
  
  useEffect(() => { 
    saveData(); 
    if (rangeEndIdx === 0 && shifts.length > 0) setRangeEndIdx(shifts.length - 1);
  }, [shifts, personNames, isDarkMode, schichtTypen]);

  useEffect(() => {
    if (activeTab === 'Schichten' && shifts.length > 0) {
      const timer = setTimeout(() => { jumpToCurrentDay(); }, 50);
      return () => clearTimeout(timer);
    }
  }, [activeTab, activeFilterRange]);

  const saveData = async () => {
    try { 
      await AsyncStorage.setItem('@planer_nano_final_v65', JSON.stringify({
        shifts, personNames, isDarkMode, schichtTypen
      })); 
    } catch (e) {}
  };

  const loadData = async () => {
    try {
      const saved = await AsyncStorage.getItem('@planer_nano_final_v65');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.shifts && parsed.shifts.length > 0) { 
          setShifts(parsed.shifts); 
          setRangeEndIdx(parsed.shifts.length - 1); 
        }
        if (parsed?.personNames) setPersonNames(parsed.personNames);
        if (parsed?.isDarkMode !== undefined) setIsDarkMode(parsed.isDarkMode);
        if (parsed?.schichtTypen) setSchichtTypen(parsed.schichtTypen);
      }
    } catch (e) {}
  };

  // DIREKTER ORDNER-AUSWAHL EXPORT (STORAGE ACCESS FRAMEWORK)
  const handleExportJsonFile = async () => {
    try {
      const exportPayload = { shifts, personNames, isDarkMode, schichtTypen };
      const jsonString = JSON.stringify(exportPayload, null, 2);
      const fileName = `schichtplaner_backup_${new Date().toISOString().slice(0, 10)}.json`;

      if (Platform.OS === 'android' && FileSystem && FileSystem.StorageAccessFramework) {
        const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (permissions.granted) {
          const uri = await FileSystem.StorageAccessFramework.createFileAsync(
            permissions.directoryUri,
            fileName,
            'application/json'
          );
          await FileSystem.writeAsStringAsync(uri, jsonString, {
            encoding: FileSystem.EncodingType.UTF8,
          });
          Alert.alert('Erfolg', 'Backup wurde im gewählten Ordner gespeichert!');
        }
      } else if (FileSystem && FileSystem.documentDirectory) {
        const fileUri = `${FileSystem.documentDirectory}${fileName}`;
        await FileSystem.writeAsStringAsync(fileUri, jsonString, {
          encoding: FileSystem.EncodingType.UTF8,
        });
        Alert.alert('Erfolg', `Gespeichert unter:\n${fileUri}`);
      } else {
        Alert.alert('Fehler', 'Export wird auf diesem Gerät nicht unterstützt.');
      }
    } catch (e) {
      Alert.alert('Fehler', 'Export der JSON-Datei ist fehlgeschlagen: ' + e.message);
    }
  };

  // JSON-DATEI IMPORT
  const handleImportJsonFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/json', '*/*'],
        copyToCacheDirectory: true
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const fileUri = result.assets[0].uri;
        const fileContent = await FileSystem.readAsStringAsync(fileUri);
        
        const parsed = JSON.parse(fileContent);
        if (!parsed || !parsed.shifts || !Array.isArray(parsed.shifts)) {
          Alert.alert("Fehler", "Die ausgewählte Datei hat ein ungültiges Format.");
          return;
        }

        setShifts(parsed.shifts);
        if (parsed.personNames) setPersonNames(parsed.personNames);
        if (parsed.schichtTypen) setSchichtTypen(parsed.schichtTypen);
        if (parsed.isDarkMode !== undefined) setIsDarkMode(parsed.isDarkMode);
        
        setRangeStartIdx(0);
        setRangeEndIdx(parsed.shifts.length - 1);
        Alert.alert("Erfolg", "Backup erfolgreich aus JSON-Datei importiert!");
      }
    } catch (e) {
      Alert.alert("Fehler beim Import", "Die Datei konnte nicht gelesen oder verarbeitet werden.");
    }
  };

  const checkAndAppendYear = (offsetY, contentHeight, layoutMeasurementHeight) => {
    if (offsetY + layoutMeasurementHeight >= contentHeight - 300) {
      const lastShift = shifts[shifts.length - 1];
      if (lastShift) {
        const lastYear = parseInt(lastShift.datum.split('.')[2]);
        const nextYear = lastYear + 1;
        if (nextYear <= 2035) {
          const additionalDays = generateDynamicYears(personKeys, nextYear, nextYear);
          setShifts(prev => [...prev, ...additionalDays]);
        }
      }
    }
    if (offsetY <= 100) {
      const firstShift = shifts[0];
      if (firstShift) {
        const firstYear = parseInt(firstShift.datum.split('.')[2]);
        const prevYear = firstYear - 1;
        if (prevYear >= 2020) {
          const pastDays = generateDynamicYears(personKeys, prevYear, prevYear);
          setShifts(prev => [...pastDays, ...prev]);
        }
      }
    }
  };

  const parseRawToDate = (rawStr) => {
    if (rawStr.length !== 8) return null;
    const day = parseInt(rawStr.substring(0, 2), 10);
    const month = parseInt(rawStr.substring(2, 4), 10) - 1;
    const year = parseInt(rawStr.substring(4, 8), 10);
    return new Date(year, month, day);
  };

  const formatRawToDisplay = (rawStr) => {
    const cleaned = rawStr.replace(/[^0-9]/g, '');
    if (cleaned.length <= 2) return cleaned;
    if (cleaned.length <= 4) return `${cleaned.substring(0, 2)}.${cleaned.substring(2)}`;
    return `${cleaned.substring(0, 2)}.${cleaned.substring(2, 4)}.${cleaned.substring(4, 8)}`;
  };

  const handleStartRawChange = (text, nextRef) => {
    const cleaned = text.replace(/[^0-9]/g, '').substring(0, 8);
    setFilterStartRaw(cleaned);
    if (cleaned.length === 8 && nextRef && nextRef.current) {
      nextRef.current.focus();
    }
  };

  const handleEndRawChange = (text) => {
    const cleaned = text.replace(/[^0-9]/g, '').substring(0, 8);
    setFilterEndRaw(cleaned);
    if (cleaned.length === 8) {
      setTimeout(() => {
        executeFilter(filterStartRaw, cleaned);
      }, 100);
    }
  };

  const executeFilter = (startRaw, endRaw) => {
    if (startRaw.length !== 8 || endRaw.length !== 8) {
      Alert.alert("Fehler", "Bitte gib jeweils 8 Zahlen im Format TTMMJJJJ ein.");
      return;
    }
    const dStart = parseRawToDate(startRaw);
    const dEnd = parseRawToDate(endRaw);

    if (!dStart || !dEnd || isNaN(dStart.getTime()) || isNaN(dEnd.getTime())) {
      Alert.alert("Fehler", "Ungültiges Datum eingegeben.");
      return;
    }
    if (dStart > dEnd) {
      Alert.alert("Fehler", "Das Startdatum muss vor dem Enddatum liegen.");
      return;
    }

    const startDisplay = formatRawToDisplay(startRaw);
    const endDisplay = formatRawToDisplay(endRaw);

    setActiveFilterRange({ start: startDisplay, end: endDisplay });
    setSearchModalVisible(false);
  };

  const jumpToCurrentDay = () => {
    let targetIdx = -1;
    if (activeFilterRange) {
      targetIdx = 0;
    } else {
      const today = new Date();
      const tag = String(today.getDate()).padStart(2, '0');
      const monat = String(today.getMonth() + 1).padStart(2, '0');
      const jahr = today.getFullYear();
      const heuteStr = `${tag}.${monat}.${jahr}`;
      targetIdx = currentMonthShifts.findIndex(s => s.datum === heuteStr);
      if (targetIdx === -1) {
        const aktuellerMonatStr = `${monat}.${jahr}`;
        targetIdx = currentMonthShifts.findIndex(s => s.datum.endsWith(aktuellerMonatStr));
      }
    }
    if (targetIdx !== -1 && verticalScrollRef.current) {
      let estimatedY = 0; 
      let lastMonth = null;
      let lastYear = null;
      for (let i = 0; i < targetIdx; i++) {
        const parts = currentMonthShifts[i].datum.split('.');
        const currentItemMonth = parts[1];
        const currentItemYear = parts[2];
        if (lastMonth === null || currentItemMonth !== lastMonth || currentItemYear !== lastYear) {
          estimatedY += 30; 
          lastMonth = currentItemMonth;
          lastYear = currentItemYear;
        }
        estimatedY += 45; 
      }
      verticalScrollRef.current.scrollTo({ y: estimatedY, animated: false });
      if (dateScrollRef.current) {
        dateScrollRef.current.scrollTo({ y: estimatedY, animated: false });
      }
    }
  };

  const handleManualDateChange = (text) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    setManualDateText(cleaned);
    if (cleaned.length === 8) {
      const tag = cleaned.substring(0, 2);
      const monat = cleaned.substring(2, 4);
      const jahr = cleaned.substring(4, 8);
      const formatiertesDatum = `${tag}.${monat}.${jahr}`;
      
      let idx = shifts.findIndex(s => s.datum === formatiertesDatum);
      if (idx === -1) {
        const targetYearNum = parseInt(jahr);
        const firstShift = shifts[0];
        const lastShift = shifts[shifts.length - 1];
        const firstYearNum = firstShift ? parseInt(firstShift.datum.split('.')[2]) : 2020;
        const lastYearNum = lastShift ? parseInt(lastShift.datum.split('.')[2]) : 2030;

        if (targetYearNum < firstYearNum && targetYearNum >= 2020) {
          const pastDays = generateDynamicYears(personKeys, targetYearNum, firstYearNum - 1);
          const updatedShifts = [...pastDays, ...shifts];
          setShifts(updatedShifts);
          idx = updatedShifts.findIndex(s => s.datum === formatiertesDatum);
        } else if (targetYearNum > lastYearNum && targetYearNum <= 2035) {
          const futureDays = generateDynamicYears(personKeys, lastYearNum + 1, targetYearNum);
          const updatedShifts = [...shifts, ...futureDays];
          setShifts(updatedShifts);
          idx = updatedShifts.findIndex(s => s.datum === formatiertesDatum);
        }
      }

      if (idx !== -1) {
        if (selectingType === 'start') {
          if (idx > rangeEndIdx) setRangeEndIdx(idx);
          setRangeStartIdx(idx);
        } else {
          if (idx < rangeStartIdx) setRangeStartIdx(idx);
          setRangeEndIdx(idx);
        }
        setRangeModalVisible(false);
      } else {
        Alert.alert("Fehler", `Datum ${formatiertesDatum} konnte nicht gefunden werden.`);
      }
    }
  };

  const handleManualDateSubmit = () => {
    if (manualDateText.length < 8) {
      Alert.alert("Fehler", "Bitte gib das Datum vollständig im Format TTMMJJJJ ein.");
      return;
    }
    handleManualDateChange(manualDateText);
  };

  const theme = isDarkMode ? { bg: '#121212', head: '#1976d2', txt: '#eee', card: '#1e1e1e', acc: '#64b5f6', bor: '#333', sub: '#aaa' } 
                           : { bg: '#f8f9fa', head: '#1976d2', txt: '#222', card: 'white', acc: '#1976d2', bor: '#eee', sub: '#666' };

  const statisticsShifts = useMemo(() => {
    return shifts.slice(rangeStartIdx, rangeEndIdx + 1);
  }, [shifts, rangeStartIdx, rangeEndIdx]);

  const currentMonthShifts = useMemo(() => {
    if (activeFilterRange) {
      const dStart = parseRawToDate(filterStartRaw);
      const dEnd = parseRawToDate(filterEndRaw);
      if (dStart && dEnd) {
        const filtered = shifts.filter(s => {
          const parts = s.datum.split('.');
          const dCurrent = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
          return dCurrent && dCurrent >= dStart && dCurrent <= dEnd;
        });
        return filtered.length > 0 ? filtered : shifts;
      }
    }
    const today = new Date();
    const targetMMYYYY = `${String(today.getMonth() + 1).padStart(2, '0')}.${today.getFullYear()}`;
    const elements = shifts.filter(s => s.datum.endsWith(targetMMYYYY));
    return elements.length > 0 ? elements : shifts;
  }, [shifts, activeFilterRange, filterStartRaw, filterEndRaw]);

  const filterDisplayTitle = useMemo(() => {
    if (activeFilterRange) {
      return `${activeFilterRange.start} - ${activeFilterRange.end}`;
    }
    return "Aktueller Monat";
  }, [activeFilterRange]);

  const applyCustomShift = () => {
    if (!customLabel.trim()) {
      Alert.alert("Hinweis", "Bitte gib ein Schichtkürzel ein.");
      return;
    }
    const labelUpper = customLabel.trim().toUpperCase();
    setShifts(shifts.map(r => r.id === selectedCell.rowId ? {
      ...r, 
      [selectedCell.pk]: labelUpper, 
      [selectedCell.pk+'Col']: customColor
    } : r));
    if (copyModeActive) {
      setCopiedValue({ label: labelUpper, color: customColor });
    }
    setModalVisible(false);
  };

  const handleFeiertagClick = (datumStr) => {
    const name = getHessenFeiertagName(datumStr);
    if (name) {
      Alert.alert("Feiertag (Hessen)", name);
    }
  };

  const handleCellPress = (rowId, pk, currentLabel, currentColor) => {
    if (copyModeActive) {
      if (!copiedValue) {
        setCopiedValue({ label: currentLabel, color: currentColor });
      } else {
        setShifts(shifts.map(r => r.id === rowId ? {
          ...r,
          [pk]: copiedValue.label,
          [pk + 'Col']: copiedValue.color
        } : r));
      }
    } else {
      setSelectedCell({ rowId, pk });
      setCustomLabel('');
      setEditingSchichtIdx(null); 
      setModalVisible(true);
    }
  };

  const startEditSchichtTimes = (idx, schicht) => {
    setEditingSchichtIdx(idx);
    setEditStartTime('');
    setEditEndTime('');
    setEditPauseTime('');
  };

  const saveSchichtTimes = (idx) => {
    const updated = [...schichtTypen];
    updated[idx] = {
      ...updated[idx],
      s: editStartTime || updated[idx].s,
      e: editEndTime || updated[idx].e,
      p: editPauseTime || updated[idx].p
    };
    setSchichtTypen(updated);
    setEditingSchichtIdx(null);
  };

  const renderStatistik = () => {
    const colWidth = 26;
    const feiertageOhneSonntag = statisticsShifts.filter(s => {
      const isHoliday = isHessenFeiertag(s.datum) !== null;
      const isNotSunday = s.tag !== 'So';
      return isHoliday && isNotSunday;
    });
    const moeglicheFeiertageAnzahl = feiertageOhneSonntag.length;

    return (
      <View style={{flex: 1}}>
        <View style={[styles.rangeSelector, {backgroundColor: theme.card, borderBottomColor: theme.bor}]}>
            <TouchableOpacity style={styles.rangePart} onPress={() => { setSelectingType('start'); setManualDateText(''); setRangeModalVisible(true); }}>
                <Text style={styles.rangeLabel}>VON (Tippen)</Text>
                <Text style={[styles.rangeDate, {color: theme.acc}]}>{shifts[rangeStartIdx]?.datum || 'Auswählen'}</Text>
            </TouchableOpacity>
            <Ionicons name="arrow-forward" size={16} color={theme.sub} />
            <TouchableOpacity style={styles.rangePart} onPress={() => { setSelectingType('end'); setManualDateText(''); setRangeModalVisible(true); }}>
                <Text style={styles.rangeLabel}>BIS (Tippen)</Text>
                <Text style={[styles.rangeDate, {color: theme.acc}]}>{shifts[rangeEndIdx]?.datum || 'Auswählen'}</Text>
            </TouchableOpacity>
        </View>

        <ScrollView style={{flex: 1}} removeClippedSubviews={true} contentContainerStyle={{padding: 10, paddingBottom: 220}}>
          <View style={styles.calendarHeader}><Ionicons name="calendar-outline" size={18} color={theme.acc} /><Text style={[styles.statTitle, {color: theme.txt}]}>Feiertagsstatistik (Mo–Sa) (%)</Text></View>
          <View style={[styles.matrixCard, {backgroundColor: theme.card, marginBottom: 20}]}>
            <View style={[styles.matrixHeader, {borderBottomColor: theme.bor}]}>
              <Text style={[styles.matrixNameLabel, {color: theme.sub, width: 80}]}>NAME</Text>
              <View style={{flexDirection: 'row', flex: 1, justifyContent: 'space-around'}}>
                <Text style={[styles.miniBoxTxt, {color: theme.sub, fontWeight: 'bold', width: 60, textAlign: 'center'}]}>TAGE</Text>
                <Text style={[styles.miniBoxTxt, {color: theme.sub, fontWeight: 'bold', width: 60, textAlign: 'center'}]}>PROZENT</Text>
              </View>
            </View>
            {personKeys.map(pk => {
              const eingeteilteFeiertage = feiertageOhneSonntag.filter(s => s[pk] !== '—').length;
              const prozent = moeglicheFeiertageAnzahl > 0 ? Math.round((100 / moeglicheFeiertageAnzahl) * eingeteilteFeiertage) : 0;
              return (
                <View key={pk} style={[styles.matrixRow, {borderBottomColor: theme.bor}]}>
                  <Text style={[styles.matrixName, {color: theme.txt, width: 80}]} numberOfLines={1}>{personNames[pk]}</Text>
                  <View style={{flexDirection: 'row', flex: 1, justifyContent: 'space-around'}}>
                    <Text style={{width: 60, textAlign: 'center', fontSize: 11, color: theme.txt}}>{eingeteilteFeiertage} / {moeglicheFeiertageAnzahl}</Text>
                    <Text style={{width: 60, textAlign: 'center', fontSize: 11, fontWeight: 'bold', color: eingeteilteFeiertage > 0 ? theme.txt : '#ccc'}}>{moeglicheFeiertageAnzahl > 0 && eingeteilteFeiertage > 0 ? `${prozent}%` : '0%'}</Text>
                  </View>
                </View>
              );
            })}
          </View>

          <View style={styles.statHeader}><Ionicons name="pie-chart-outline" size={18} color={theme.acc} /><Text style={[styles.statTitle, {color: theme.txt}]}>Gesamtverteilung (%)</Text></View>
          <View style={[styles.matrixCard, {backgroundColor: theme.card, marginBottom: 20}]}>
            <View style={[styles.matrixHeader, {borderBottomColor: theme.bor}]}>
              <Text style={[styles.matrixNameLabel, {color: theme.sub, width: 55}]}>NAME</Text>
              <View style={{flexDirection: 'row', flex: 1, justifyContent: 'space-between'}}>
                {schichtTypen.map((t, i) => (<View key={i} style={{width: colWidth, justifyContent: 'center'}}><View style={[styles.miniBox, {backgroundColor: t.c, width: 23}]}><Text style={styles.miniBoxTxt}>{t.l}</Text></View></View>))}
              </View>
            </View>
            {personKeys.map(pk => {
              const total = statisticsShifts.filter(s => s[pk] !== '—').length;
              return (
                <View key={pk} style={[styles.matrixRow, {borderBottomColor: theme.bor}]}>
                  <Text style={[styles.matrixName, {color: theme.txt, width: 55}]} numberOfLines={1}>{personNames[pk]}</Text>
                  <View style={{flexDirection: 'row', flex: 1, justifyContent: 'space-between'}}>
                    {schichtTypen.map((t, i) => {
                      const count = statisticsShifts.filter(s => s[pk] === t.l).length;
                      const p = total > 0 ? Math.round((count/total)*100) : 0;
                      return (<View key={i} style={{width: colWidth, alignItems: 'center'}}><Text style={[styles.matrixCellTxt, {color: p > 0 ? theme.txt : '#ccc'}]}>{p > 0 ? `${p}%` : '·'}</Text></View>);
                    })}
                  </View>
                </View>
              );
            })}
          </View>

          <View style={[styles.statHeader, {marginTop: 0}]}><Ionicons name="log-in-outline" size={18} color={theme.acc} /><Text style={[styles.statTitle, {color: theme.txt}]}>1. Schicht nach „Frei“ (%)</Text></View>
          <View style={[styles.matrixCard, {backgroundColor: theme.card, marginBottom: 20}]}>
            <View style={[styles.matrixHeader, {borderBottomColor: theme.bor}]}>
              <Text style={[styles.matrixNameLabel, {color: theme.sub, width: 55}]}>NAME</Text>
              <View style={{flexDirection: 'row', flex: 1, justifyContent: 'space-between'}}>
                {schichtTypen.map((t, i) => (<View key={i} style={{width: colWidth, alignItems: 'center'}}><View style={[styles.miniBox, {backgroundColor: t.c, width: 23}]}><Text style={styles.miniBoxTxt}>{t.l}</Text></View></View>))}
              </View>
            </View>
            {personKeys.map(pk => {
              let afterFreeShifts = [];
              statisticsShifts.forEach((s, idx) => {
                const absIdx = rangeStartIdx + idx;
                if (absIdx > 0 && shifts[absIdx - 1][pk] === '—' && s[pk] !== '—') afterFreeShifts.push(s[pk]);
              });
              const totalAF = afterFreeShifts.length;
              return (
                <View key={pk} style={[styles.matrixRow, {borderBottomColor: theme.bor}]}>
                  <Text style={[styles.matrixName, {color: theme.txt, width: 55}]} numberOfLines={1}>{personNames[pk]}</Text>
                  <View style={{flexDirection: 'row', flex: 1, justifyContent: 'space-between'}}>
                    {schichtTypen.map((t, i) => {
                      const count = afterFreeShifts.filter(type => type === t.l).length;
                      const p = totalAF > 0 ? Math.round((count/totalAF)*100) : 0;
                      return (<View key={i} style={{width: colWidth, alignItems: 'center'}}><Text style={[styles.matrixCellTxt, {color: p > 0 ? theme.txt : '#ccc'}]}>{p > 0 ? `${p}%` : '·'}</Text></View>);
                    })}
                  </View>
                </View>
              );
            })}
          </View>

          <View style={[styles.statHeader, {marginTop: 0}]}><Ionicons name="people-outline" size={18} color={theme.acc} /><Text style={[styles.statTitle, {color: theme.txt}]}>Partner-Duo SV/PDI (%)</Text></View>
          <View style={[styles.matrixCard, {backgroundColor: theme.card, paddingHorizontal: 5, marginBottom: 20}]}>
              <View style={[styles.matrixHeader, {borderBottomColor: theme.bor}]}>
                  <Text style={[styles.matrixNameLabel, {color: theme.sub, width: 45}]}>NAME</Text>
                  <View style={{flexDirection: 'row', flex: 1, justifyContent: 'space-around'}}>
                      {personKeys.map(pk => (<Text key={pk} style={{fontSize: 7, fontWeight: 'bold', color: theme.sub, width: 22, textAlign: 'center'}}>{personNames[pk].substring(0,2).toUpperCase()}</Text>))}
                  </View>
              </View>
              {personKeys.map(p1 => (
                  <View key={p1} style={[styles.matrixRow, {borderBottomColor: theme.bor}]}>
                      <Text style={[styles.matrixName, {color: theme.txt, width: 45, fontSize: 9}]} numberOfLines={1}>{personNames[p1]}</Text>
                      <View style={{flexDirection: 'row', flex: 1, justifyContent: 'space-around'}}>
                          {personKeys.map(p2 => {
                              if (p1 === p2) return <Text key={p2} style={{width: 22, textAlign: 'center', color: '#ccc', fontSize: 8}}>--</Text>;
                              const common = statisticsShifts.filter(s => ((s[p1] === 'SV' && s[p2] === 'PDI') || (s[p1] === 'PDI' && s[p2] === 'SV'))).length;
                              const p1T = statisticsShifts.filter(s => (s[p1] === 'SV' || s[p1] === 'PDI')).length;
                              const perc = p1T > 0 ? Math.round((common/p1T)*100) : 0;
                              return (<Text key={p2} style={{width: 22, textAlign: 'center', fontSize: 8, fontWeight: 'bold', color: perc > 0 ? theme.txt : '#ddd'}}>{perc > 0 ? perc : '·'}</Text>);
                          })}
                      </View>
                  </View>
              ))}
          </View>

          <View style={[styles.statHeader, {marginTop: 0}]}><Ionicons name="arrow-forward-circle-outline" size={18} color={theme.acc} /><Text style={[styles.statTitle, {color: theme.txt}]}>Folge-Duo: SV nach PDI (%)</Text></View>
          <View style={[styles.matrixCard, {backgroundColor: theme.card, paddingHorizontal: 5, marginBottom: 20}]}>
              <View style={[styles.matrixHeader, {borderBottomColor: theme.bor}]}>
                  <Text style={[styles.matrixNameLabel, {color: theme.sub, width: 45}]}>SV von</Text>
                  <View style={{flexDirection: 'row', flex: 1, justifyContent: 'space-around'}}>
                      {personKeys.map(pk => (<Text key={pk} style={{fontSize: 7, fontWeight: 'bold', color: theme.sub, width: 22, textAlign: 'center'}}>{personNames[pk].substring(0,2).toUpperCase()}</Text>))}
                  </View>
              </View>
              {personKeys.map(pSv => {
                  return (
                      <View key={pSv} style={[styles.matrixRow, {borderBottomColor: theme.bor}]}>
                          <Text style={[styles.matrixName, {color: theme.txt, width: 45, fontSize: 9}]} numberOfLines={1}>{personNames[pSv]}</Text>
                          <View style={{flexDirection: 'row', flex: 1, justifyContent: 'space-around'}}>
                              {personKeys.map(pPdi => {
                                  let pdiOnPrevDayCount = 0;
                                  let totalSvOnCurrentDays = 0;

                                  statisticsShifts.forEach((s, idx) => {
                                      const absoluteIdx = rangeStartIdx + idx;
                                      if (s[pSv] === 'SV' && absoluteIdx > 0) {
                                          totalSvOnCurrentDays++;
                                          if (shifts[absoluteIdx - 1][pPdi] === 'PDI') {
                                              pdiOnPrevDayCount++;
                                          }
                                      }
                                  });

                                  const perc = totalSvOnCurrentDays > 0 ? Math.round((pdiOnPrevDayCount / totalSvOnCurrentDays) * 100) : 0;
                                  return (<Text key={pPdi} style={{width: 22, textAlign: 'center', fontSize: 8, fontWeight: 'bold', color: perc > 0 ? theme.txt : '#ddd'}}>{perc > 0 ? `${perc}%` : '·'}</Text>);
                              })}
                          </View>
                      </View>
                  );
              })}
          </View>

          <View style={[styles.statHeader, {marginTop: 0}]}><Ionicons name="calendar-outline" size={18} color={theme.acc} /><Text style={[styles.statTitle, {color: theme.txt}]}>SV am Wochenende (%)</Text></View>
          <View style={[styles.matrixCard, {backgroundColor: theme.card, marginBottom: 20}]}>
            <View style={[styles.matrixHeader, {borderBottomColor: theme.bor}]}>
              <Text style={[styles.matrixNameLabel, {color: theme.sub, width: 80}]}>NAME</Text>
              <View style={{flexDirection: 'row', flex: 1, justifyContent: 'space-around'}}><Text style={[styles.miniBoxTxt, {color: '#e91e63', fontWeight: 'bold'}]}>SAMSTAG</Text><Text style={[styles.miniBoxTxt, {color: '#e91e63', fontWeight: 'bold'}]}>SONNTAG</Text></View>
            </View>
            {personKeys.map(pk => {
              const saS = statisticsShifts.filter(s => s.tag === 'Sa' && s[pk] !== '—');
              const soS = statisticsShifts.filter(s => s.tag === 'So' && s[pk] !== '—');
              const saP = saS.length > 0 ? Math.round((saS.filter(s => s[pk] === 'SV').length / saS.length) * 100) : 0;
              const soP = soS.length > 0 ? Math.round((soS.filter(s => s[pk] === 'SV').length / soS.length) * 100) : 0;
              return (
                <View key={pk} style={[styles.matrixRow, {borderBottomColor: theme.bor}]}>
                  <Text style={[styles.matrixName, {color: theme.txt, width: 80}]} numberOfLines={1}>{personNames[pk]}</Text>
                  <View style={{flexDirection: 'row', flex: 1, justifyContent: 'space-around'}}>
                      <Text style={{width: 60, textAlign: 'center', fontSize: 10, color: saS.length > 0 ? theme.txt : '#ddd'}}>{saP}%</Text>
                      <Text style={{width: 60, textAlign: 'center', fontSize: 10, color: soS.length > 0 ? theme.txt : '#ddd'}}>{soP}%</Text>
                  </View>
                </View>
              );
            })}
          </View>

          {/* DATENSICHERUNG PER ORDNER-AUSWAHL */}
          <View style={[styles.statHeader, {marginTop: 0}]}><Ionicons name="cloud-upload-outline" size={18} color={theme.acc} /><Text style={[styles.statTitle, {color: theme.txt}]}>Datensicherung (JSON-Datei)</Text></View>
          <View style={[styles.matrixCard, {backgroundColor: theme.card, marginBottom: 20}]}>
            <Text style={{color: theme.sub, fontSize: 11, marginBottom: 15, textAlign: 'center'}}>
              Wähle einen Ordner auf deinem Smartphone zum Speichern oder lade ein Backup hoch.
            </Text>
            <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
              <TouchableOpacity style={[styles.backupBtn, {backgroundColor: '#4caf50'}]} onPress={handleExportJsonFile}>
                <Ionicons name="download-outline" size={16} color="white" style={{marginBottom: 4}} />
                <Text style={styles.btnTxt}>Exportieren</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.backupBtn, {backgroundColor: theme.acc}]} onPress={handleImportJsonFile}>
                <Ionicons name="folder-open-outline" size={16} color="white" style={{marginBottom: 4}} />
                <Text style={styles.btnTxt}>Importieren</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={[styles.statHeader, {marginTop: 5}]}><Ionicons name="information-circle-outline" size={18} color={theme.acc} /><Text style={[styles.statTitle, {color: theme.txt}]}>App-Informationen</Text></View>
          <View style={[styles.matrixCard, styles.devCard, {backgroundColor: theme.card, borderColor: theme.bor}]}>
            <View style={styles.devRow}>
              <Ionicons name="code-working" size={16} color={theme.sub} style={{marginRight: 10}} />
              <View>
                <Text style={[styles.devLabel, {color: theme.sub}]}>Entwickler</Text>
                <Text style={[styles.devValue, {color: theme.txt}]}>Özgür Cetin</Text>
              </View>
            </View>
            <View style={[styles.devDivider, {backgroundColor: theme.bor}]} />
            <View style={styles.devRow}>
              <Ionicons name="mail-outline" size={16} color={theme.sub} style={{marginRight: 10}} />
              <View>
                <Text style={[styles.devLabel, {color: theme.sub}]}>Kontakt & Support</Text>
                <Text style={[styles.devValue, {color: theme.txt}]}>ozgur.cetin@web.de</Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]}>
      <StatusBar translucent backgroundColor="transparent" barStyle={isDarkMode ? "light-content" : "dark-content"} />
      <View style={[styles.header, {backgroundColor: theme.head, justifyContent: 'center'}]}>
        <Text style={styles.hTitle}>Schichtplaner</Text>
        <TouchableOpacity style={styles.hBtnRight} onPress={() => setIsDarkMode(!isDarkMode)}>
          <Ionicons name={isDarkMode ? "sunny" : "moon"} size={22} color="white" />
        </TouchableOpacity>
      </View>

      {activeTab === 'Schichten' ? (
        <View style={{flex: 1}}>
          <View style={[styles.searchFilterContainer, {backgroundColor: theme.card, borderBottomColor: theme.bor}]}>
            <TouchableOpacity style={styles.searchBarButton} onPress={() => { setFilterStartRaw(''); setFilterEndRaw(''); setSearchModalVisible(true); }}>
              <Ionicons name="calendar-outline" size={15} color={theme.acc} style={{marginRight: 6}} />
              <Text style={[styles.searchText, {color: theme.txt}]} numberOfLines={1}>
                Zeitraum: <Text style={{color: theme.acc, fontWeight: 'bold'}}>{filterDisplayTitle}</Text>
              </Text>
            </TouchableOpacity>
            
            {activeFilterRange !== null && (
              <TouchableOpacity style={styles.clearFilterBtn} onPress={() => setActiveFilterRange(null)}>
                <Ionicons name="close-circle" size={18} color="#e91e63" />
              </TouchableOpacity>
            )}
            
            <TouchableOpacity 
              style={[
                styles.copyModeBtn, 
                { backgroundColor: copyModeActive ? '#e91e63' : (isDarkMode ? '#2c2c2c' : '#f0f0f0') }
              ]} 
              onPress={() => {
                setCopyModeActive(!copyModeActive);
                setCopiedValue(null);
              }}
            >
              <Ionicons name="copy-outline" size={13} color={copyModeActive ? 'white' : theme.txt} style={{marginRight: 3}} />
              <Text style={[styles.copyModeBtnTxt, { color: copyModeActive ? 'white' : theme.txt }]} numberOfLines={1}>
                {copyModeActive ? 'Kopieren AN' : 'Muster'}
              </Text>
            </TouchableOpacity>
          </View>

          {copyModeActive && (
            <View style={[styles.copyInfoBar, { backgroundColor: copiedValue ? (copiedValue.color === 'krank' ? '#b71c1c' : copiedValue.color) : '#555' }]}>
              <Text style={[styles.copyInfoBarTxt, {color: '#fff'}]}>
                {copiedValue 
                  ? `Muster [${copiedValue.label}] gewählt. Tippe Zellen zum Einfügen.` 
                  : 'Schritt 1: Tippe eine Tabellenzelle an, deren Schicht du kopieren willst.'}
              </Text>
            </View>
          )}

          {/* PERFEKT SYNCHRONISIERTE ZWEI-SPALTEN-STRUKTUR */}
          <View style={{flex: 1}}>
            
            {/* OBERE KOPFZEILE: Links "TAG" (fest), Rechts Namen */}
            <View style={{height: 45, flexDirection: 'row', backgroundColor: theme.head, zIndex: 30, elevation: 20}}>
              <View style={[styles.headerSideCell, {backgroundColor: theme.head, height: 45}]}>
                <Text style={styles.headLabel}>TAG</Text>
              </View>
              <ScrollView 
                ref={horizontalHeaderRef}
                horizontal 
                showsHorizontalScrollIndicator={false}
                scrollEnabled={false}
                style={{flex: 1}}
              >
                <View style={{flexDirection: 'row', height: 45, alignItems: 'center'}}>
                  {personKeys.map(k => (
                    <TouchableOpacity 
                      key={k} 
                      style={styles.headerCell} 
                      onPress={() => { setSelectedPersonKey(k); setTempName(personNames[k]); setNameModalVisible(true); }}
                    >
                      <Text style={styles.headLabel} numberOfLines={1}>{personNames[k]}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            {/* HAUPTBEREICH UNTER DER KOPFZEILE */}
            <View style={{flex: 1, flexDirection: 'row'}}>
              
              {/* 1. LINKE SPALTE: Datum */}
              <View style={{width: 55, overflow: 'hidden', backgroundColor: theme.card}}>
                <ScrollView 
                  ref={dateScrollRef}
                  scrollEnabled={false}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{paddingBottom: 220}}
                >
                  {currentMonthShifts.map((s, index) => {
                    const prevS = index > 0 ? currentMonthShifts[index-1] : null;
                    const isNewM = !prevS || s.datum.split('.')[1] !== prevS.datum.split('.')[1] || s.datum.split('.')[2] !== prevS.datum.split('.')[2];
                    const ft = isHessenFeiertag(s.datum);

                    return (
                      <React.Fragment key={`date-row-${s.id}`}>
                        {isNewM && (
                          <View style={{height: 30, backgroundColor: '#1a1a1a', justifyContent: 'center', paddingLeft: 4}}>
                            <Text style={styles.monthLabelTxt} numberOfLines={1}>
                              {monate[parseInt(s.datum.split('.')[1])-1].substring(0,3)} {s.datum.split('.')[2].substring(2)}
                            </Text>
                          </View>
                        )}
                        <TouchableOpacity 
                          disabled={!ft}
                          onPress={() => handleFeiertagClick(s.datum)}
                          style={[
                            styles.sideCell, 
                            {
                              borderBottomColor: theme.bor, 
                              backgroundColor: ft ? (isDarkMode ? '#3d1010' : '#ffebee') : theme.card, 
                              height: 45,
                              width: 55
                            }
                          ]}
                        >
                          <Text style={[styles.tagTxt, {color: (s.tag==='Sa'||s.tag==='So'||ft) ? '#e91e63' : theme.txt}]}>{s.tag}</Text>
                          <Text style={[styles.dateTxt, {color: isDarkMode ? '#ccc' : '#666'}]}>{s.datum.split('.')[0]}.</Text>
                        </TouchableOpacity>
                      </React.Fragment>
                    );
                  })}
                </ScrollView>
              </View>

              {/* 2. RECHTER BEREICH: Schichten */}
              <View style={{flex: 1}}>
                <ScrollView 
                  ref={verticalScrollRef}
                  style={{flex: 1}}
                  contentContainerStyle={{paddingBottom: 220}}
                  showsVerticalScrollIndicator={true}
                  onScroll={(e) => {
                    const offsetY = e.nativeEvent.contentOffset.y;
                    if (dateScrollRef.current) {
                      dateScrollRef.current.scrollTo({ y: offsetY, animated: false });
                    }
                    const contentHeight = e.nativeEvent.contentSize.height;
                    const layoutMeasurementHeight = e.nativeEvent.layoutMeasurement.height;
                    checkAndAppendYear(offsetY, contentHeight, layoutMeasurementHeight);
                  }}
                  scrollEventThrottle={16}
                >
                  <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={true}
                    onScroll={(e) => {
                      const offsetX = e.nativeEvent.contentOffset.x;
                      if (horizontalHeaderRef.current) {
                        horizontalHeaderRef.current.scrollTo({ x: offsetX, animated: false });
                      }
                    }}
                    scrollEventThrottle={16}
                  >
                    <View style={{flexDirection: 'column'}}>
                      {currentMonthShifts.map((s, index) => {
                        const prevS = index > 0 ? currentMonthShifts[index-1] : null;
                        const isNewM = !prevS || s.datum.split('.')[1] !== prevS.datum.split('.')[1] || s.datum.split('.')[2] !== prevS.datum.split('.')[2];

                        return (
                          <View key={`grid-row-${s.id}`}>
                            {isNewM && (
                              <View style={{height: 30, backgroundColor: '#1a1a1a', width: personKeys.length * 60}} />
                            )}

                            <View style={{flexDirection: 'row', height: 45}}>
                              {personKeys.map(pk => {
                                const isSick = s[pk+'Col'] === 'krank';
                                const isUrl = s[pk] === 'URL';
                                
                                const cellBg = isSick 
                                  ? '#b71c1c' 
                                  : (isUrl ? '#00bcd4' : s[pk+'Col']);
                                
                                let cellLabel = isSick ? `✚ ${s[pk]}` : s[pk];

                                return (
                                  <TouchableOpacity 
                                    key={pk} 
                                    delayPressIn={0}
                                    activeOpacity={0.5}
                                    style={[styles.cell, {backgroundColor: cellBg, borderBottomColor: theme.bor, height: 45}]} 
                                    onPress={() => handleCellPress(s.id, pk, s[pk], s[pk+'Col'])}
                                  >
                                    <Text style={[styles.cellTxt, {color: cellBg === 'transparent' ? theme.txt : 'white'}]}>{cellLabel}</Text>
                                  </TouchableOpacity>
                                );
                              })}
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  </ScrollView>
                </ScrollView>
              </View>

            </View>

          </View>
        </View>
      ) : renderStatistik()}

      <View style={[styles.tabBar, {backgroundColor: theme.card, borderTopColor: theme.bor}]}>
        <TouchableOpacity style={styles.tab} onPress={() => setActiveTab('Schichten')}><Ionicons name="grid" size={22} color={activeTab === 'Schichten' ? theme.acc : '#888'} /><Text style={{fontSize: 10, color: activeTab === 'Schichten' ? theme.acc : '#888', marginTop: 4}}>Schichten</Text></TouchableOpacity>
        <TouchableOpacity style={styles.tab} onPress={() => setActiveTab('Statistik')}><Ionicons name="stats-chart" size={22} color={activeTab === 'Statistik' ? theme.acc : '#888'} /><Text style={{fontSize: 10, color: activeTab === 'Statistik' ? theme.acc : '#888', marginTop: 4}}>Statistik</Text></TouchableOpacity>
      </View>

      {/* MODAL FÜR ZEITRAUM-EINGABE TTMMJJJJ */}
      <Modal visible={searchModalVisible} transparent animationType="fade">
        <View style={styles.modalBack}>
          <View style={[styles.modalBox, {backgroundColor: theme.card, padding: 20}]}>
            <Text style={{color: theme.txt, fontWeight: 'bold', fontSize: 16, marginBottom: 5, textAlign: 'center'}}>Zeitraum eingeben</Text>
            <Text style={{color: theme.sub, fontSize: 11, marginBottom: 15, textAlign: 'center'}}>Eingabe in TTMMJJJJ (Ausgabe: TT.MM.JJJJ)</Text>
            
            <Text style={{color: theme.sub, fontSize: 10, fontWeight: 'bold', marginBottom: 4}}>STARTDATUM (TTMMJJJJ)</Text>
            <TextInput 
              style={[styles.input, {color: theme.txt, borderBottomColor: theme.acc, fontSize: 18, marginBottom: 15, textAlign: 'center'}]} 
              value={formatRawToDisplay(filterStartRaw)} 
              onChangeText={(t) => handleStartRawChange(t, filterEndInputRef)} 
              placeholder="01102026" 
              placeholderTextColor="#666"
              keyboardType="numeric"
              maxLength={10}
              autoFocus={true}
            />

            <Text style={{color: theme.sub, fontSize: 10, fontWeight: 'bold', marginBottom: 4}}>ENDDATUM (TTMMJJJJ)</Text>
            <TextInput 
              ref={filterEndInputRef}
              style={[styles.input, {color: theme.txt, borderBottomColor: theme.acc, fontSize: 18, marginBottom: 20, textAlign: 'center'}]} 
              value={formatRawToDisplay(filterEndRaw)} 
              onChangeText={handleEndRawChange} 
              placeholder="31032027" 
              placeholderTextColor="#666"
              keyboardType="numeric"
              maxLength={10}
            />

            <View style={styles.modalButtonRowHorizontal}>
              <TouchableOpacity style={[styles.saveBtn, {backgroundColor: '#9e9e9e', flex: 0.48}]} onPress={() => setSearchModalVisible(false)}>
                <Text style={{color: 'white', fontWeight: 'bold'}}>Abbrechen</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveBtn, {backgroundColor: theme.acc, flex: 0.48}]} onPress={() => executeFilter(filterStartRaw, filterEndRaw)}>
                <Text style={{color: 'white', fontWeight: 'bold'}}>Anwenden</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={rangeModalVisible} transparent animationType="fade">
          <View style={styles.modalBack}>
            <View style={[styles.modalBox, {backgroundColor: theme.card}]}>
              <Text style={{color: theme.txt, fontWeight: 'bold', marginBottom: 5, textAlign: 'center'}}>Datum eingeben</Text>
              <Text style={{color: theme.sub, fontSize: 11, marginBottom: 15, textAlign: 'center'}}>Format: TTMMJJJJ (z.B. 15062024)</Text>
              <TextInput 
                style={[styles.input, {color: theme.txt, borderBottomColor: theme.acc}]} 
                value={manualDateText} 
                onChangeText={handleManualDateChange} 
                placeholder="TTMMJJJJ" 
                placeholderTextColor="#666"
                keyboardType="numeric"
                maxLength={8}
                autoFocus={true} 
              />
              <View style={styles.modalButtonRowHorizontal}>
                <TouchableOpacity style={[styles.saveBtn, {backgroundColor: '#9e9e9e', flex: 0.48}]} onPress={() => setRangeModalVisible(false)}>
                  <Text style={{color: 'white', fontWeight: 'bold'}}>Abbrechen</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.saveBtn, {backgroundColor: theme.acc, flex: 0.48}]} onPress={handleManualDateSubmit}>
                  <Text style={{color: 'white', fontWeight: 'bold'}}>Übernehmen</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
      </Modal>

      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalBack}>
          <View style={[styles.modalBox, {backgroundColor: theme.card, width: '95%', padding: 15, maxHeight: '85%'}]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={{color: theme.sub, fontSize: 11, fontWeight: 'bold', marginBottom: 6}}>MANUELLE SCHICHT ERSTELLEN</Text>
              <View style={[styles.customShiftContainer, {borderColor: theme.bor}]}>
                <TextInput
                  style={[styles.customInput, {color: theme.txt, backgroundColor: isDarkMode ? '#2c2c2c' : '#f5f5f5'}]}
                  placeholder="Kürzel (z.B. NACHT)"
                  placeholderTextColor="#888"
                  maxLength={6}
                  value={customLabel}
                  onChangeText={setCustomLabel}
                />
                <TouchableOpacity style={[styles.customAddBtn, {backgroundColor: customColor}]} onPress={applyCustomShift}>
                  <Text style={{color: 'white', fontWeight: 'bold', fontSize: 12}}>Einfügen</Text>
                </TouchableOpacity>
              </View>
              
              <View style={styles.paletteRow}>
                {customColorPalette.map((color) => (
                  <TouchableOpacity 
                    key={color} 
                    style={[styles.paletteCircle, {backgroundColor: color, borderWidth: customColor === color ? 3 : 0, borderColor: theme.txt}]} 
                    onPress={() => setCustomColor(color)}
                  />
                ))}
              </View>

              <View style={[styles.divider, {backgroundColor: theme.bor}]} />

              <Text style={{color: theme.sub, fontSize: 11, fontWeight: 'bold', marginBottom: 8}}>VORGEFERTIGTE SCHICHTEN (Zelle antippen / Uhr bearbeiten)</Text>
              <View style={styles.modalGrid}>
                  {schichtTypen.map((s, i) => (
                    <View key={i} style={styles.optContainer}>
                      <TouchableOpacity 
                        style={[styles.opt, {backgroundColor: s.c, borderRadius: 12, width: '100%', margin: 0, paddingVertical: 4}]} 
                        onPress={() => { 
                          setShifts(shifts.map(r => r.id === selectedCell.rowId ? {...r, [selectedCell.pk]: s.l, [selectedCell.pk+'Col']: s.c} : r)); 
                          if (copyModeActive) { setCopiedValue({ label: s.l, color: s.c }); }
                          setModalVisible(false); 
                        }}
                      >
                        <Text style={{color: 'white', fontWeight: 'bold', fontSize: 10, textAlign: 'center'}} numberOfLines={1}>{s.l}</Text>
                        <Text style={{color: 'rgba(255,255,255,0.8)', fontSize: 7, marginTop: 1, textAlign: 'center'}} numberOfLines={1}>
                          {s.s || '—'}-{s.e || '—'}
                        </Text>
                      </TouchableOpacity>
                      
                      <TouchableOpacity 
                        style={styles.timeEditIconBtn} 
                        onPress={() => startEditSchichtTimes(i, s)}
                      >
                        <Ionicons name="time-outline" size={14} color={theme.acc} />
                      </TouchableOpacity>
                    </View>
                  ))}

                  <View style={styles.optContainer}>
                    <TouchableOpacity 
                      style={[styles.opt, {backgroundColor: '#00bcd4', borderRadius: 12, width: '100%', margin: 0, paddingVertical: 4, justifyContent: 'center', alignItems: 'center'}]} 
                      onPress={() => { 
                        setShifts(shifts.map(r => r.id === selectedCell.rowId ? {...r, [selectedCell.pk]: 'URL', [selectedCell.pk+'Col']: '#00bcd4'} : r));
                        if (copyModeActive) { setCopiedValue({ label: 'URL', color: '#00bcd4' }); }
                        setModalVisible(false);
                      }}
                    >
                      <Ionicons name="airplane-outline" size={12} color="white" />
                      <Text style={{color: 'white', fontSize: 9, fontWeight: 'bold', marginTop: 1, textAlign: 'center'}} numberOfLines={1}>URLAUB</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.optContainer}>
                    <TouchableOpacity 
                      style={[styles.opt, {backgroundColor: isDarkMode ? '#2c2c2c' : '#f0f0f0', borderRadius: 12, borderWidth: 1, borderColor: isDarkMode ? '#444' : '#ddd', width: '100%', margin: 0, paddingVertical: 4, justifyContent: 'center', alignItems: 'center'}]} 
                      onPress={() => { 
                        setShifts(shifts.map(r => r.id === selectedCell.rowId ? {...r, [selectedCell.pk]: '—', [selectedCell.pk+'Col']: 'transparent'} : r)); 
                        if (copyModeActive) { setCopiedValue({ label: '—', color: 'transparent' }); }
                        setModalVisible(false); 
                      }}
                    >
                      <Ionicons name="remove-circle-outline" size={12} color={isDarkMode ? '#aaa' : '#888'} />
                      <Text style={{color: isDarkMode ? '#aaa' : '#888', fontSize: 9, fontWeight: 'bold', marginTop: 1, textAlign: 'center'}} numberOfLines={1}>FREI</Text>
                    </TouchableOpacity>
                  </View>
              </View>

              {editingSchichtIdx !== null && (
                <View style={[styles.timeEditBox, {backgroundColor: isDarkMode ? '#222' : '#f9f9f9', borderColor: theme.bor}]}>
                  <Text style={{color: theme.txt, fontWeight: 'bold', fontSize: 12, marginBottom: 12}}>
                    Zeiten für [{schichtTypen[editingSchichtIdx].l}] anpassen:
                  </Text>
                  <View style={styles.timeInputRow}>
                    <View style={styles.timeInputWrapper}>
                      <Text style={styles.timeInputSubLabel}>Start</Text>
                      <TextInput 
                        style={[styles.timeTextInput, {color: theme.txt, borderColor: theme.bor}]} 
                        value={editStartTime} 
                        onChangeText={(t) => formatTimeHHMM(t, setEditStartTime, editEndRef)} 
                        placeholder="06:00" 
                        placeholderTextColor="#777"
                        keyboardType="numeric"
                        maxLength={5}
                      />
                    </View>
                    <View style={styles.timeInputWrapper}>
                      <Text style={styles.timeInputSubLabel}>Ende</Text>
                      <TextInput 
                        ref={editEndRef}
                        style={[styles.timeTextInput, {color: theme.txt, borderColor: theme.bor}]} 
                        value={editEndTime} 
                        onChangeText={(t) => formatTimeHHMM(t, setEditEndTime, editPauseRef)} 
                        placeholder="14:30" 
                        placeholderTextColor="#777"
                        keyboardType="numeric"
                        maxLength={5}
                      />
                    </View>
                    <View style={styles.timeInputWrapper}>
                      <Text style={styles.timeInputSubLabel}>Pause (Min)</Text>
                      <TextInput 
                        ref={editPauseRef}
                        style={[styles.timeTextInput, {color: theme.txt, borderColor: theme.bor}]} 
                        value={editPauseTime} 
                        onChangeText={setEditPauseTime} 
                        placeholder="30" 
                        placeholderTextColor="#777"
                        keyboardType="numeric"
                      />
                    </View>
                  </View>
                  <View style={styles.timeActionRow}>
                    <TouchableOpacity style={[styles.timeBtnSmall, {backgroundColor: '#9e9e9e', marginRight: 10}]} onPress={() => setEditingSchichtIdx(null)}>
                      <Text style={{color: 'white', fontSize: 12, fontWeight: 'bold'}}>Abbrechen</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.timeBtnSmall, {backgroundColor: theme.acc}]} onPress={() => saveSchichtTimes(editingSchichtIdx)}>
                      <Text style={{color: 'white', fontSize: 12, fontWeight: 'bold'}}>Speichern</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              <TouchableOpacity onPress={() => setModalVisible(false)} style={{marginTop: 20, marginBottom: 10}}><Text style={{color: theme.acc, textAlign: 'center', fontWeight: 'bold'}}>Schließen</Text></TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={nameModalVisible} transparent animationType="slide">
        <View style={styles.modalBack}><View style={[styles.modalBox, {backgroundColor: theme.card}]}>
          <TextInput style={[styles.input, {color: theme.txt, borderBottomColor: theme.acc}]} value={tempName} onChangeText={setTempName} autoFocus={true} />
          <TouchableOpacity style={[styles.saveBtn, {backgroundColor: theme.acc}]} onPress={() => { setPersonNames({...personNames, [selectedPersonKey]: tempName}); setNameModalVisible(false); }}><Text style={{color: 'white', fontWeight: 'bold'}}>Speichern</Text></TouchableOpacity>
        </View></View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 50, paddingBottom: 15, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', position: 'relative' },
  hBtnRight: { position: 'absolute', right: 0, paddingHorizontal: 15, bottom: 15 },
  hTitle: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  headerSideCell: { width: 55, height: 45, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  headerCell: { width: 60, height: 45, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  headLabel: { color: 'white', fontSize: 11, fontWeight: 'bold', textAlign: 'center' },
  monthLabel: { backgroundColor: '#1a1a1a', height: 30, justifyContent: 'center', paddingLeft: 10 },
  monthLabelTxt: { color: 'white', fontSize: 11, fontWeight: 'bold' },
  sideCell: { width: 55, height: 45, justifyContent: 'center', alignItems: 'center', borderBottomWidth: 1, flexShrink: 0 },
  cell: { width: 60, height: 45, justifyContent: 'center', alignItems: 'center', borderBottomWidth: 1, flexShrink: 0 },
  tagTxt: { fontSize: 12, fontWeight: '600' },
  dateTxt: { fontSize: 10, color: '#999' },
  cellTxt: { fontSize: 12, fontWeight: '600', textAlign: 'center' },
  tabBar: { flexDirection: 'row', height: 85, borderTopWidth: 1, paddingBottom: 25, paddingHorizontal: 20, position: 'absolute', bottom: 0, left: 0, right: 0 },
  tab: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  statHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, paddingLeft: 5, marginTop: 15 },
  calendarHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, paddingLeft: 5, marginTop: 15 },
  statTitle: { fontSize: 14, fontWeight: 'bold', marginLeft: 8 },
  matrixCard: { borderRadius: 18, padding: 12, elevation: 3, marginBottom: 10 },
  matrixHeader: { flexDirection: 'row', borderBottomWidth: 1, paddingBottom: 8, marginBottom: 5 },
  matrixNameLabel: { fontWeight: 'bold', fontSize: 9 },
  miniBox: { height: 18, borderRadius: 4, justifyContent: 'center', alignItems: 'center' },
  miniBoxTxt: { color: 'white', fontSize: 7, fontWeight: 'bold', textAlign: 'center' },
  matrixRow: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 0.5, alignItems: 'center' },
  matrixName: { fontSize: 11, fontWeight: 'bold' },
  matrixCellTxt: { textAlign: 'center', fontSize: 9, fontWeight: 'bold' },
  rangeSelector: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingVertical: 12, borderBottomWidth: 1 },
  rangePart: { alignItems: 'center', flex: 1 },
  rangeLabel: { fontSize: 8, color: '#888', fontWeight: 'bold' },
  rangeDate: { fontSize: 14, fontWeight: 'bold' },
  modalBack: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' },
  modalBox: { width: '85%', padding: 25, borderRadius: 24 },
  modalGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start' },
  optContainer: { width: '22%', aspectRatio: 1, margin: '1.5%', position: 'relative', justifyContent: 'center', alignItems: 'center' },
  opt: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 2 },
  timeEditIconBtn: { position: 'absolute', right: 2, top: 2, backgroundColor: 'rgba(255,255,255,0.8)', borderRadius: 8, width: 16, height: 16, justifyContent: 'center', alignItems: 'center', elevation: 2 },
  timeEditBox: { marginTop: 15, borderWidth: 1, borderRadius: 12, padding: 12 },
  timeInputRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  timeInputWrapper: { flex: 1, marginHorizontal: 3 },
  timeInputSubLabel: { fontSize: 10, color: '#888', marginBottom: 4, fontWeight: 'bold', textAlign: 'center' },
  timeTextInput: { borderWidth: 1, borderRadius: 6, height: 36, paddingHorizontal: 4, fontSize: 12, textAlign: 'center' },
  timeActionRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 14 },
  timeBtnSmall: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 6 },
  input: { borderBottomWidth: 2, fontSize: 22, textAlign: 'center', marginBottom: 15 },
  saveBtn: { paddingVertical: 12, paddingHorizontal: 10, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  modalButtonRowHorizontal: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', flexWrap: 'nowrap' },
  backupBtn: { padding: 12, borderRadius: 10, flex: 0.48, alignItems: 'center' },
  btnTxt: { color: 'white', fontWeight: 'bold', fontSize: 11 },
  customShiftContainer: { flexDirection: 'row', borderWidth: 1, borderRadius: 10, overflow: 'hidden', marginBottom: 10 },
  customInput: { width: '70%', height: 40, paddingHorizontal: 12, fontSize: 13, fontWeight: 'bold' },
  customAddBtn: { width: '30%', justifyContent: 'center', alignItems: 'center' },
  paletteRow: { flexDirection: 'row', justifyContent: 'flex-start', flexWrap: 'wrap', marginBottom: 15, paddingHorizontal: 5, gap: 8 },
  paletteCircle: { width: 32, height: 32, borderRadius: 16 },
  divider: { height: 1, width: '100%', marginVertical: 12 },
  searchFilterContainer: { flexDirection: 'row', paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center', borderBottomWidth: 1, flexWrap: 'nowrap' },
  searchBarButton: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingVertical: '5%', paddingHorizontal: 8, borderRadius: 6, backgroundColor: 'rgba(0,0,0,0.04)', marginRight: 6 },
  searchText: { fontSize: 11, fontWeight: '500' },
  clearFilterBtn: { paddingRight: 6, justifyContent: 'center', alignItems: 'center' },
  devCard: { borderWidth: 1, paddingVertical: 15, paddingHorizontal: 18, marginBottom: 30 },
  devRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  devLabel: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  devValue: { fontSize: 14, fontWeight: 'bold' },
  devDivider: { height: 0.5, width: '100%', marginVertical: 10 },
  copyModeBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5, paddingHorizontal: 8, borderRadius: 6 },
  copyModeBtnTxt: { fontSize: 11, fontWeight: 'bold' },
  copyInfoBar: { paddingVertical: 6, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  copyInfoBarTxt: { color: 'white', fontSize: 11, fontWeight: '600', textAlign: 'center' }
});
