import React, { useState, useEffect, useRef, useMemo } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Modal, TextInput, StatusBar, SafeAreaView, Alert, Share } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Hilfsfunktion zur Generierung des kompletten Jahres 2026 als initiale Datenbasis
const generateYear2026 = (personKeys) => {
  const yearData = [];
  const startDate = new Date(2026, 0, 1); // 1. Januar 2026
  const endDate = new Date(2026, 11, 31); // 31. Dezember 2026
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
      ...Object.fromEntries(personKeys.map(k => [k, '--'])),
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
  const [backupInput, setBackupInput] = useState('');

  const [rangeStartIdx, setRangeStartIdx] = useState(0);
  const [rangeEndIdx, setRangeEndIdx] = useState(0);
  const [rangeModalVisible, setRangeModalVisible] = useState(false);
  const [selectingType, setSelectingType] = useState('start'); 
  const [manualDateText, setManualDateText] = useState('');

  // Zustände für den historischen Suchfilter
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [selectedMonthFilter, setSelectedMonthFilter] = useState(''); // Format: "MM.YYYY" oder leer für aktuell

  // Zustände für frei konfigurierbare manuelle Schichten im Modal
  const [customLabel, setCustomLabel] = useState('');
  const [customColor, setCustomColor] = useState('#9c27b0');

  const customColorPalette = ['#9c27b0', '#e67e22', '#2ecc71', '#34495e', '#1abc9c', '#7f8c8d'];

  const initialNames = { p1: 'P1', p2: 'P2', p3: 'P3', p4: 'P4', p5: 'P5', p6: 'P6', p7: 'P7', p8: 'P8', p9: 'P9', p10: 'P10' };
  const [personNames, setPersonNames] = useState(initialNames);
  const personKeys = Object.keys(initialNames);
  const monate = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

  const schichtTypen = [
    {l:'SV',c:'#e91e63'}, {l:'PDI',c:'#4caf50'}, {l:'STL',c:'#ffc107'},
    {l:'FHR',c:'#00bcd4'}, {l:'FD',c:'#ff80ab'}, {l:'SD',c:'#b39ddb'},
    {l:'QS',c:'#ff9800'}, {l:'TS',c:'#9e9e9e'}, {l:'QC',c:'#009688'}
  ];

  const getHessenFeiertage = (jahr) => {
    const f = Math.floor, a = jahr % 19, b = f(jahr / 100), c = jahr % 100,
          d = f(b / 4), e = b % 4, g = f((8 * b + 13) / 25),
          h = (19 * a + b - d - g + 15) % 30, i = f(c / 4), k = c % 4,
          l = (32 + 2 * e + 2 * i - h - k) % 7, m = f((a + 11 * h + 19 * l) / 433),
          n = f((h + l - 7 * m + 90) / 25), p = (h + l - 7 * m + 114) % 31;
    const ostern = new Date(jahr, n - 1, p + 1);
    const feiertage = { [`01.01.${jahr}`]: "NJ", [`01.05.${jahr}`]: "TdA", [`03.10.${jahr}`]: "TdE", [`25.12.${jahr}`]: "W1", [`26.12.${jahr}`]: "W2" };
    const addDays = (date, days) => {
      const d = new Date(date); d.setDate(d.getDate() + days);
      return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
    };
    feiertage[addDays(ostern, -2)] = "KF"; feiertage[addDays(ostern, 0)] = "OS"; feiertage[addDays(ostern, 1)] = "OM";
    feiertage[addDays(ostern, 39)] = "CH"; feiertage[addDays(ostern, 50)] = "PM"; feiertage[addDays(ostern, 60)] = "FL";
    return feiertage;
  };

  const isHessenFeiertag = (datumStr) => {
    const jahr = parseInt(datumStr.split('.')[2]);
    return getHessenFeiertage(jahr)[datumStr] || null;
  };

  // Initialisiert die App mit dem kompletten Kalenderjahr 2026 statt nur einem Tag
  const [shifts, setShifts] = useState(() => generateYear2026(Object.keys(initialNames)));

  const headerScrollRef = useRef(null);
  const mainVerticalScrollRef = useRef(null);
  const rowHeights = useRef({});

  useEffect(() => { loadData(); }, []);
  
  useEffect(() => { 
    saveData(); 
    if (rangeEndIdx === 0 && shifts.length > 0) setRangeEndIdx(shifts.length - 1);
  }, [shifts, personNames, isDarkMode]);

  useEffect(() => {
    if (activeTab === 'Schichten' && shifts.length > 0) {
      const timer = setTimeout(() => {
        jumpToCurrentMonth(); 
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [activeTab]);

  const saveData = async () => {
    try { await AsyncStorage.setItem('@planer_nano_final_v5', JSON.stringify({shifts, personNames, isDarkMode})); } catch (e) {}
  };

  const loadData = async () => {
    try {
      const saved = await AsyncStorage.getItem('@planer_nano_final_v5');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.shifts && parsed.shifts.length > 0) { 
          setShifts(parsed.shifts); 
          setRangeEndIdx(parsed.shifts.length - 1); 
        }
        if (parsed?.personNames) setPersonNames(parsed.personNames);
        if (parsed?.isDarkMode !== undefined) setIsDarkMode(parsed.isDarkMode);
      }
    } catch (e) {}
  };

  const handleExport = async () => {
    const data = JSON.stringify({ shifts, personNames });
    try { await Share.share({ message: data, title: 'Planer Backup' }); } catch (e) {}
  };

  const handleImport = () => {
    if (!backupInput) { Alert.alert("Hinweis", "Bitte füge zuerst einen Code ein."); return; }
    try {
      const parsed = JSON.parse(backupInput.trim());
      if (parsed.shifts) {
        setShifts(parsed.shifts);
        if (parsed.personNames) setPersonNames(parsed.personNames);
        setRangeStartIdx(0);
        setRangeEndIdx(parsed.shifts.length - 1);
        setBackupInput('');
        Alert.alert("Erfolg", "Import abgeschlossen!");
      }
    } catch (e) { Alert.alert("Fehler", "Ungültiger Code."); }
  };

  const jumpToCurrentMonth = () => {
    // Ermittelt die Scroll-Position des aktuellen Monats basierend auf den generierten Zeilen
    let targetMMYYYY = selectedMonthFilter;
    if (!targetMMYYYY) {
      const today = new Date();
      targetMMYYYY = `${String(today.getMonth() + 1).padStart(2, '0')}.${today.getFullYear()}`;
    }
    
    const targetIdx = shifts.findIndex(s => s.datum.endsWith(targetMMYYYY));
    if (targetIdx !== -1 && mainVerticalScrollRef.current) {
      // Ungefähre Scroll-Berechnung anhand der Zeilenhöhe (45px) plus Header-Verschiebungen
      const estimatedY = targetIdx * 45;
      mainVerticalScrollRef.current.scrollTo({ y: estimatedY, animated: false });
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
      
      const idx = shifts.findIndex(s => s.datum === formatiertesDatum);
      
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
        Alert.alert("Fehler", `Datum ${formatiertesDatum} nicht in der Tabelle gefunden.`);
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

  const theme = isDarkMode ? { bg: '#121212', head: '#1f1f1f', txt: '#eee', card: '#1e1e1e', acc: '#64b5f6', bor: '#333', sub: '#aaa' } 
                           : { bg: '#f8f9fa', head: '#1976d2', txt: '#222', card: 'white', acc: '#1976d2', bor: '#eee', sub: '#666' };

  const filteredShifts = useMemo(() => {
    return shifts.slice(rangeStartIdx, rangeEndIdx + 1);
  }, [shifts, rangeStartIdx, rangeEndIdx]);

  const availableMonths = useMemo(() => {
    const monthsSet = new Set();
    shifts.forEach(s => {
      const parts = s.datum.split('.');
      if(parts.length === 3) {
        monthsSet.add(`${parts[1]}.${parts[2]}`);
      }
    });
    return Array.from(monthsSet).sort((a, b) => {
      const [mA, yA] = a.split('.').map(Number);
      const [mB, yB] = b.split('.').map(Number);
      return yB !== yA ? yB - yA : mB - mA; 
    });
  }, [shifts]);

  const currentMonthShifts = useMemo(() => {
    let targetMMYYYY = selectedMonthFilter;
    if (!targetMMYYYY) {
      const today = new Date();
      targetMMYYYY = `${String(today.getMonth() + 1).padStart(2, '0')}.${today.getFullYear()}`;
    }
    
    const elements = shifts.filter(s => s.datum.endsWith(targetMMYYYY));
    return elements.length > 0 ? elements : shifts;
  }, [shifts, selectedMonthFilter]);

  const filterDisplayTitle = useMemo(() => {
    if (!selectedMonthFilter) return "Aktueller Monat";
    const [m, y] = selectedMonthFilter.split('.');
    return `${monate[parseInt(m) - 1]} ${y}`;
  }, [selectedMonthFilter]);

  const applyCustomShift = () => {
    if (!customLabel.trim()) {
      Alert.alert("Hinweis", "Bitte gib ein Schichtkürzel ein.");
      return;
    }
    setShifts(shifts.map(r => r.id === selectedCell.rowId ? {
      ...r, 
      [selectedCell.pk]: customLabel.trim().toUpperCase(), 
      [selectedCell.pk+'Col']: customColor
    } : r));
    setModalVisible(false);
  };

  const renderStatistik = () => {
    const colWidth = 28; 

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

        <ScrollView style={{flex: 1}} removeClippedSubviews={true} contentContainerStyle={{padding: 10, paddingBottom: 150}}>
          
          <View style={styles.statHeader}><Ionicons name="pie-chart-outline" size={18} color={theme.acc} /><Text style={[styles.statTitle, {color: theme.txt}]}>Gesamtverteilung (%)</Text></View>
          <View style={[styles.matrixCard, {backgroundColor: theme.card}]}>
            <View style={[styles.matrixHeader, {borderBottomColor: theme.bor}]}>
              <Text style={[styles.matrixNameLabel, {color: theme.sub, width: 55}]}>NAME</Text>
              <View style={{flexDirection: 'row', flex: 1, justifyContent: 'space-between'}}>
                {schichtTypen.map((t, i) => (<View key={i} style={{width: colWidth, alignItems: 'center'}}><View style={[styles.miniBox, {backgroundColor: t.c, width: 24}]}><Text style={styles.miniBoxTxt}>{t.l}</Text></View></View>))}
              </View>
            </View>
            {personKeys.map(pk => {
              const total = filteredShifts.filter(s => s[pk] !== '--').length;
              return (
                <View key={pk} style={[styles.matrixRow, {borderBottomColor: theme.bor}]}>
                  <Text style={[styles.matrixName, {color: theme.txt, width: 55}]} numberOfLines={1}>{personNames[pk]}</Text>
                  <View style={{flexDirection: 'row', flex: 1, justifyContent: 'space-between'}}>
                    {schichtTypen.map((t, i) => {
                      const count = filteredShifts.filter(s => s[pk] === t.l).length;
                      const p = total > 0 ? Math.round((count/total)*100) : 0;
                      return (<View key={i} style={{width: colWidth, alignItems: 'center'}}><Text style={[styles.matrixCellTxt, {color: p > 0 ? theme.txt : '#ccc'}]}>{p > 0 ? `${p}%` : '·'}</Text></View>);
                    })}
                  </View>
                </View>
              );
            })}
          </View>

          <View style={[styles.statHeader, {marginTop: 20}]}><Ionicons name="log-in-outline" size={18} color={theme.acc} /><Text style={[styles.statTitle, {color: theme.txt}]}>1. Schicht nach "Frei" (%)</Text></View>
          <View style={[styles.matrixCard, {backgroundColor: theme.card}]}>
            <View style={[styles.matrixHeader, {borderBottomColor: theme.bor}]}>
              <Text style={[styles.matrixNameLabel, {color: theme.sub, width: 55}]}>NAME</Text>
              <View style={{flexDirection: 'row', flex: 1, justifyContent: 'space-between'}}>
                {schichtTypen.map((t, i) => (<View key={i} style={{width: colWidth, alignItems: 'center'}}><View style={[styles.miniBox, {backgroundColor: t.c, width: 24}]}><Text style={styles.miniBoxTxt}>{t.l}</Text></View></View>))}
              </View>
            </View>
            {personKeys.map(pk => {
              let afterFreeShifts = [];
              filteredShifts.forEach((s, idx) => {
                const absIdx = rangeStartIdx + idx;
                if (absIdx > 0 && shifts[absIdx - 1][pk] === '--' && s[pk] !== '--') afterFreeShifts.push(s[pk]);
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

          <View style={[styles.statHeader, {marginTop: 20}]}><Ionicons name="people-outline" size={18} color={theme.acc} /><Text style={[styles.statTitle, {color: theme.txt}]}>Partner-Duo SV/PDI (%)</Text></View>
          <View style={[styles.matrixCard, {backgroundColor: theme.card, paddingHorizontal: 5}]}>
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
                              const common = filteredShifts.filter(s => (s[p1] === 'SV' && s[p2] === 'PDI') || (s[p1] === 'PDI' && s[p2] === 'SV')).length;
                              const p1T = filteredShifts.filter(s => s[p1] === 'SV' || s[p1] === 'PDI').length;
                              const perc = p1T > 0 ? Math.round((common/p1T)*100) : 0;
                              return (<Text key={p2} style={{width: 22, textAlign: 'center', fontSize: 8, fontWeight: 'bold', color: perc > 0 ? theme.txt : '#ddd'}}>{perc > 0 ? perc : '·'}</Text>);
                          })}
                      </View>
                  </View>
              ))}
          </View>

          <View style={[styles.statHeader, {marginTop: 20}]}><Ionicons name="calendar-outline" size={18} color={theme.acc} /><Text style={[styles.statTitle, {color: theme.txt}]}>SV am Wochenende (%)</Text></View>
          <View style={[styles.matrixCard, {backgroundColor: theme.card}]}>
            <View style={[styles.matrixHeader, {borderBottomColor: theme.bor}]}>
              <Text style={[styles.matrixNameLabel, {color: theme.sub, width: 80}]}>NAME</Text>
              <View style={{flexDirection: 'row', flex: 1, justifyContent: 'space-around'}}><Text style={[styles.miniBoxTxt, {color: '#e91e63', fontWeight: 'bold'}]}>SAMSTAG</Text><Text style={[styles.miniBoxTxt, {color: '#e91e63', fontWeight: 'bold'}]}>SONNTAG</Text></View>
            </View>
            {personKeys.map(pk => {
              const saS = filteredShifts.filter(s => s.tag === 'Sa' && s[pk] !== '--');
              const soS = filteredShifts.filter(s => s.tag === 'So' && s[pk] !== '--');
              const saP = saS.length > 0 ? Math.round((saS.filter(s => s[pk] === 'SV').length / saS.length) * 100) : null;
              const soP = soS.length > 0 ? Math.round((soS.filter(s => s[pk] === 'SV').length / soS.length) * 100) : null;
              return (
                <View key={pk} style={[styles.matrixRow, {borderBottomColor: theme.bor}]}>
                  <Text style={[styles.matrixName, {color: theme.txt, width: 80}]}>{personNames[pk]}</Text>
                  <View style={{flexDirection: 'row', flex: 1, justifyContent: 'space-around'}}>
                      <Text style={{width: 60, textAlign: 'center', fontSize: 10, color: saP !== null ? theme.txt : '#ddd'}}>{saP !== null ? saP + '%' : '·'}</Text>
                      <Text style={{width: 60, textAlign: 'center', fontSize: 10, color: soP !== null ? theme.txt : '#ddd'}}>{soP !== null ? soP + '%' : '·'}</Text>
                  </View>
                </View>
              );
            })}
          </View>

          <View style={[styles.statHeader, {marginTop: 20}]}><Ionicons name="cloud-upload-outline" size={18} color={theme.acc} /><Text style={[styles.statTitle, {color: theme.txt}]}>Datensicherung</Text></View>
          <View style={[styles.matrixCard, {backgroundColor: theme.card}]}>
            <TextInput style={[styles.backupInput, {backgroundColor: isDarkMode ? '#121212' : '#f9f9f9', color: theme.txt, borderColor: theme.bor}]} multiline placeholder="Backup-Code hier einfügen..." placeholderTextColor="#888" value={backupInput} onChangeText={setBackupInput} />
            <View style={{flexDirection: 'row', justifyContent: 'space-between', marginTop: 15}}>
              <TouchableOpacity style={[styles.backupBtn, {backgroundColor: '#4caf50'}]} onPress={handleExport}><Text style={styles.btnTxt}>Senden (Export)</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.backupBtn, {backgroundColor: theme.acc}]} onPress={handleImport}><Text style={styles.btnTxt}>Laden (Import)</Text></TouchableOpacity>
            </View>
          </View>

          {/* Bereich für Entwicklerinformationen */}
          <View style={[styles.statHeader, {marginTop: 25}]}><Ionicons name="information-circle-outline" size={18} color={theme.acc} /><Text style={[styles.statTitle, {color: theme.txt}]}>App-Informationen</Text></View>
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
            <TouchableOpacity style={styles.searchBarButton} onPress={() => setSearchModalVisible(true)}>
              <Ionicons name="search-outline" size={16} color={theme.acc} style={{marginRight: 8}} />
              <Text style={[styles.searchText, {color: theme.txt}]}>
                Zeitraum ansehen: <Text style={{color: theme.acc, fontWeight: 'bold'}}>{filterDisplayTitle}</Text>
              </Text>
            </TouchableOpacity>
            {selectedMonthFilter !== '' && (
              <TouchableOpacity style={styles.clearFilterBtn} onPress={() => setSelectedMonthFilter('')}>
                <Ionicons name="close-circle" size={18} color="#e91e63" />
              </TouchableOpacity>
            )}
          </View>

          <View style={{flexDirection: 'row', backgroundColor: theme.head, height: 35, alignItems: 'center'}}>
            <View style={{width: 55, alignItems: 'center'}}><Text style={styles.headLabel}>TAG</Text></View>
            <ScrollView horizontal ref={headerScrollRef} scrollEnabled={false} showsHorizontalScrollIndicator={false}>
              {personKeys.map(k => (
                <TouchableOpacity key={k} style={{width: 60, alignItems: 'center'}} onPress={() => { setSelectedPersonKey(k); setTempName(personNames[k]); setNameModalVisible(true); }}>
                  <Text style={styles.headLabel} numberOfLines={1}>{personNames[k]}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
          <ScrollView ref={mainVerticalScrollRef} style={{flex: 1}} initialNumToRender={31} removeClippedSubviews={true} contentContainerStyle={{paddingBottom: 150}}>
            <View style={{flexDirection: 'row'}}>
              <View>
                {currentMonthShifts.map((s, i) => {
                  const ft = isHessenFeiertag(s.datum);
                  const isNewM = i === 0 || s.datum.split('.')[1] !== currentMonthShifts[i-1].datum.split('.')[1];
                  const currentYear = s.datum.split('.')[2];
                  
                  if (!rowHeights.current[s.id]) {
                    rowHeights.current[s.id] = 45;
                  }

                  return (
                    <View key={s.id}>
                      {isNewM && (
                        <View style={styles.monthLabel}>
                          <Text style={styles.monthLabelTxt}>
                            {monate[parseInt(s.datum.split('.')[1])-1]} {currentYear}
                          </Text>
                        </View>
                      )}
                      <View style={[styles.sideCell, {borderBottomColor: theme.bor, backgroundColor: ft ? (isDarkMode ? '#3d1010' : '#ffebee') : 'transparent'}]}>
                        <Text style={[styles.tagTxt, {color: (s.tag==='Sa'||s.tag==='So'||ft) ? '#e91e63' : theme.txt}]}>{s.tag}</Text>
                        <Text style={styles.dateTxt}>{s.datum.split('.')[0]}.</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
              
              <ScrollView 
                horizontal 
                cancelsTouchesInView={false}
                keyboardShouldPersistTaps="always"
                removeClippedSubviews={true}
                onScroll={(e) => headerScrollRef.current?.scrollTo({x: e.nativeEvent.contentOffset.x, animated: false})} 
                scrollEventThrottle={16}
              >
                <View>
                  {currentMonthShifts.map((s, i) => {
                    const isNewM = i === 0 || s.datum.split('.')[1] !== currentMonthShifts[i-1].datum.split('.')[1];
                    return (
                      <View key={s.id}>
                        {isNewM && <View style={[styles.monthLabel, {width: personKeys.length * 60}]} />}
                        <View style={{flexDirection: 'row'}}>
                          {personKeys.map(pk => (
                            <TouchableOpacity 
                              key={pk} 
                              delayPressIn={0}
                              activeOpacity={0.5}
                              style={[styles.cell, {backgroundColor: s[pk+'Col'], borderBottomColor: theme.bor}]} 
                              onPress={() => { setSelectedCell({rowId: s.id, pk}); setCustomLabel(''); setModalVisible(true); }}
                            >
                              <Text style={[styles.cellTxt, {color: s[pk+'Col'] === 'transparent' ? theme.txt : 'white'}]}>{s[pk]}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
          </ScrollView>
        </View>
      ) : renderStatistik()}

      <View style={[styles.tabBar, {backgroundColor: theme.card, borderTopColor: theme.bor}]}>
        <TouchableOpacity style={styles.tab} onPress={() => setActiveTab('Schichten')}><Ionicons name="grid" size={22} color={activeTab === 'Schichten' ? theme.acc : '#888'} /><Text style={{fontSize: 10, color: activeTab === 'Schichten' ? theme.acc : '#888', marginTop: 4}}>Schichten</Text></TouchableOpacity>
        <TouchableOpacity style={styles.tab} onPress={() => setActiveTab('Statistik')}><Ionicons name="stats-chart" size={22} color={activeTab === 'Statistik' ? theme.acc : '#888'} /><Text style={{fontSize: 10, color: activeTab === 'Statistik' ? theme.acc : '#888', marginTop: 4}}>Statistik</Text></TouchableOpacity>
      </View>

      <Modal visible={searchModalVisible} transparent animationType="fade">
        <View style={styles.modalBack}>
          <View style={[styles.modalBox, {backgroundColor: theme.card, maxHeight: '70%'}]}>
            <Text style={{color: theme.txt, fontWeight: 'bold', marginBottom: 15, textAlign: 'center'}}>Zeitraum auswählen</Text>
            <ScrollView style={{marginBottom: 15}}>
              <TouchableOpacity 
                style={[styles.monthFilterItem, {borderBottomColor: theme.bor, backgroundColor: selectedMonthFilter === '' ? theme.bg : 'transparent'}]} 
                onPress={() => { setSelectedMonthFilter(''); setSearchModalVisible(false); }}
              >
                <Text style={{color: theme.txt, fontWeight: 'bold'}}>Aktueller Monat (Automatisch)</Text>
              </TouchableOpacity>
              {availableMonths.map(mStr => {
                const [m, y] = mStr.split('.');
                const label = `${monate[parseInt(m) - 1]} ${y}`;
                return (
                  <TouchableOpacity 
                    key={mStr} 
                    style={[styles.monthFilterItem, {borderBottomColor: theme.bor, backgroundColor: selectedMonthFilter === mStr ? theme.bg : 'transparent'}]} 
                    onPress={() => { setSelectedMonthFilter(mStr); setSearchModalVisible(false); }}
                  >
                    <Text style={{color: theme.txt}}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity style={[styles.saveBtn, {backgroundColor: '#9e9e9e'}]} onPress={() => setSearchModalVisible(false)}>
              <Text style={{color: 'white', fontWeight: 'bold'}}>Abbrechen</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={rangeModalVisible} transparent animationType="fade">
          <View style={styles.modalBack}>
            <View style={[styles.modalBox, {backgroundColor: theme.card}]}>
              <Text style={{color: theme.txt, fontWeight: 'bold', marginBottom: 5, textAlign: 'center'}}>Datum eingeben</Text>
              <Text style={{color: theme.sub, fontSize: 11, marginBottom: 15, textAlign: 'center'}}>Format: TTMMJJJJ (z.B. 20042026)</Text>
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
              <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
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
          <View style={[styles.modalBox, {backgroundColor: theme.card, width: '90%', padding: 20}]}>
            
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

            <Text style={{color: theme.sub, fontSize: 11, fontWeight: 'bold', marginBottom: 8}}>VORGEFERTIGTE SCHICHTEN</Text>
            <View style={styles.modalGrid}>
                {schichtTypen.map((s, i) => (
                  <TouchableOpacity key={i} style={[styles.opt, {backgroundColor: s.c, borderRadius: 12}]} onPress={() => { setShifts(shifts.map(r => r.id === selectedCell.rowId ? {...r, [selectedCell.pk]: s.l, [selectedCell.pk+'Col']: s.c} : r)); setModalVisible(false); }}>
                    <Text style={{color: 'white', fontWeight: 'bold'}}>{s.l}</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity style={[styles.opt, {backgroundColor: isDarkMode ? '#2c2c2c' : '#f0f0f0', borderRadius: 12, borderWidth: 1, borderColor: isDarkMode ? '#444' : '#ddd'}]} onPress={() => { setShifts(shifts.map(r => r.id === selectedCell.rowId ? {...r, [selectedCell.pk]: '--', [selectedCell.pk+'Col']: 'transparent'} : r)); setModalVisible(false); }}>
                  <Ionicons name="remove-circle-outline" size={18} color={isDarkMode ? '#aaa' : '#888'} />
                  <Text style={{color: isDarkMode ? '#aaa' : '#888', fontSize: 9, fontWeight: 'bold'}}>FREI</Text>
                </TouchableOpacity>
            </View>

            <TouchableOpacity onPress={() => setModalVisible(false)} style={{marginTop: 15}}><Text style={{color: theme.acc, textAlign: 'center', fontWeight: 'bold'}}>Schließen</Text></TouchableOpacity>
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
  headLabel: { color: 'white', fontSize: 10, fontWeight: 'bold' },
  monthLabel: { backgroundColor: '#1a1a1a', height: 30, justifyContent: 'center', paddingLeft: 10 },
  monthLabelTxt: { color: 'white', fontSize: 11, fontWeight: 'bold' },
  sideCell: { width: 55, height: 45, justifyContent: 'center', alignItems: 'center', borderBottomWidth: 1 },
  cell: { width: 60, height: 45, justifyContent: 'center', alignItems: 'center', borderBottomWidth: 1 },
  tagTxt: { fontSize: 12, fontWeight: '600' },
  dateTxt: { fontSize: 10, color: '#999' },
  cellTxt: { fontSize: 12, fontWeight: '600' },
  tabBar: { flexDirection: 'row', height: 85, borderTopWidth: 1, paddingBottom: 25, paddingHorizontal: 20, position: 'absolute', bottom: 0, left: 0, right: 0 },
  tab: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  statHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, paddingLeft: 5 },
  statTitle: { fontSize: 14, fontWeight: 'bold', marginLeft: 8 },
  matrixCard: { borderRadius: 18, padding: 12, elevation: 3, marginBottom: 10 },
  matrixHeader: { flexDirection: 'row', borderBottomWidth: 1, paddingBottom: 8, marginBottom: 5 },
  matrixNameLabel: { fontWeight: 'bold', fontSize: 9 },
  miniBox: { height: 18, borderRadius: 4, justifyContent: 'center', alignItems: 'center' },
  miniBoxTxt: { color: 'white', fontSize: 7, fontWeight: 'bold' },
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
  opt: { width: '22%', aspectRatio: 1, margin: '1.5%', justifyContent: 'center', alignItems: 'center', borderRadius: 10 },
  input: { borderBottomWidth: 2, fontSize: 22, textAlign: 'center', marginBottom: 15 },
  saveBtn: { padding: 16, borderRadius: 14, alignItems: 'center' },
  backupInput: { height: 80, borderWidth: 1, borderRadius: 12, padding: 10, fontSize: 10, textAlignVertical: 'top' },
  backupBtn: { padding: 12, borderRadius: 10, flex: 0.48, alignItems: 'center' },
  btnTxt: { color: 'white', fontWeight: 'bold', fontSize: 11 },
  customShiftContainer: { flexDirection: 'row', borderWidth: 1, borderRadius: 10, overflow: 'hidden', marginBottom: 10 },
  customInput: { flex: 1, height: 40, paddingHorizontal: 12, fontSize: 13, fontWeight: 'bold' },
  customAddBtn: { width: 80, justifyContent: 'center', alignItems: 'center' },
  paletteRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15, paddingHorizontal: 5 },
  paletteCircle: { width: 32, height: 32, borderRadius: 16 },
  divider: { height: 1, width: '100%', marginVertical: 12 },
  
  searchFilterContainer: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center', borderBottomWidth: 1 },
  searchBarButton: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.04)' },
  searchText: { fontSize: 12, fontWeight: '500' },
  clearFilterBtn: { paddingLeft: 10, justifyContent: 'center', alignItems: 'center' },
  monthFilterItem: { paddingVertical: 14, paddingHorizontal: 10, borderBottomWidth: 0.5, width: '100%' },

  devCard: { borderWidth: 1, paddingVertical: 15, paddingHorizontal: 18, marginBottom: 30 },
  devRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  devLabel: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  devValue: { fontSize: 14, fontWeight: 'bold' },
  devDivider: { height: 0.5, width: '100%', marginVertical: 10 }
});

