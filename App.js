import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Modal, TextInput, StatusBar, SafeAreaView, Alert, Share } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function App() {
  const [activeTab, setActiveTab] = useState('Tabelle');
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

  const initialNames = { p1: 'P1', p2: 'P2', p3: 'P3', p4: 'P4', p5: 'P5', p6: 'P6', p7: 'P7', p8: 'P8', p9: 'P9', p10: 'P10' };
  const [personNames, setPersonNames] = useState(initialNames);
  const personKeys = Object.keys(initialNames);
  const monate = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

  const schichtTypen = [
    {l:'SV',c:'#e91e63'}, {l:'PDI',c:'#4caf50'}, {l:'STL',c:'#ffc107'},
    {l:'FHR',c:'#00bcd4'}, {l:'FD',c:'#ff80ab'}, {l:'SD',c:'#b39ddb'},
    {l:'QS',c:'#ff9800'}, {l:'TS',c:'#9e9e9e'}
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

  const [shifts, setShifts] = useState([
    { id: '1', tag: 'Mo', datum: '20.04.2026', ...Object.fromEntries(personKeys.map(k => [k, '--'])), ...Object.fromEntries(personKeys.map(k => [k+'Col', 'transparent'])) }
  ]);

  const headerScrollRef = useRef(null);

  useEffect(() => { loadData(); }, []);
  useEffect(() => { 
    saveData(); 
    if (rangeEndIdx === 0 && shifts.length > 0) setRangeEndIdx(shifts.length - 1);
  }, [shifts, personNames, isDarkMode]);

  const saveData = async () => {
    try { await AsyncStorage.setItem('@planer_nano_final_v5', JSON.stringify({shifts, personNames, isDarkMode})); } catch (e) {}
  };

  const loadData = async () => {
    try {
      const saved = await AsyncStorage.getItem('@planer_nano_final_v5');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.shifts) { setShifts(parsed.shifts); setRangeEndIdx(parsed.shifts.length - 1); }
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

  const addDayFuture = () => {
    const last = shifts[shifts.length - 1];
    const parts = last.datum.split('.');
    let d = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    d.setDate(d.getDate() + 1);
    const days = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
    const newEntry = { 
      id: Math.random().toString(), 
      tag: days[d.getDay()], 
      datum: `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`
    };
    personKeys.forEach(k => { newEntry[k] = '--'; newEntry[k+'Col'] = 'transparent'; });
    setShifts([...shifts, newEntry]);
  };

  const addDayPast = () => {
    const first = shifts[0];
    const parts = first.datum.split('.');
    let d = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    d.setDate(d.getDate() - 1);
    const days = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
    const newEntry = { 
      id: Math.random().toString(), 
      tag: days[d.getDay()], 
      datum: `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`
    };
    personKeys.forEach(k => { newEntry[k] = '--'; newEntry[k+'Col'] = 'transparent'; });
    setShifts([newEntry, ...shifts]);
    setRangeStartIdx(prev => prev + 1);
    setRangeEndIdx(prev => prev + 1);
  };

  const theme = isDarkMode ? { bg: '#121212', head: '#1f1f1f', txt: '#eee', card: '#1e1e1e', acc: '#64b5f6', bor: '#333', sub: '#aaa' } 
                           : { bg: '#f8f9fa', head: '#1976d2', txt: '#222', card: 'white', acc: '#1976d2', bor: '#eee', sub: '#666' };

  const renderStatistik = () => {
    const filteredShifts = shifts.slice(rangeStartIdx, rangeEndIdx + 1);
    const colWidth = 32; 

    return (
      <View style={{flex: 1}}>
        <View style={[styles.rangeSelector, {backgroundColor: theme.card, borderBottomColor: theme.bor}]}>
            <TouchableOpacity style={styles.rangePart} onPress={() => { setSelectingType('start'); setRangeModalVisible(true); }}>
                <Text style={styles.rangeLabel}>VON</Text>
                <Text style={[styles.rangeDate, {color: theme.acc}]}>{shifts[rangeStartIdx]?.datum}</Text>
            </TouchableOpacity>
            <Ionicons name="arrow-forward" size={16} color={theme.sub} />
            <TouchableOpacity style={styles.rangePart} onPress={() => { setSelectingType('end'); setRangeModalVisible(true); }}>
                <Text style={styles.rangeLabel}>BIS</Text>
                <Text style={[styles.rangeDate, {color: theme.acc}]}>{shifts[rangeEndIdx]?.datum}</Text>
            </TouchableOpacity>
        </View>

        <ScrollView style={{flex: 1}} contentContainerStyle={{padding: 10, paddingBottom: 150}}>
          <View style={styles.statHeader}><Ionicons name="pie-chart-outline" size={18} color={theme.acc} /><Text style={[styles.statTitle, {color: theme.txt}]}>Gesamtverteilung (%)</Text></View>
          <View style={[styles.matrixCard, {backgroundColor: theme.card}]}>
            <View style={[styles.matrixHeader, {borderBottomColor: theme.bor}]}>
              <Text style={[styles.matrixNameLabel, {color: theme.sub, width: 55}]}>NAME</Text>
              <View style={{flexDirection: 'row', flex: 1, justifyContent: 'space-between'}}>
                {schichtTypen.map((t, i) => (<View key={i} style={{width: colWidth, alignItems: 'center'}}><View style={[styles.miniBox, {backgroundColor: t.c, width: 26}]}><Text style={styles.miniBoxTxt}>{t.l}</Text></View></View>))}
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
                {schichtTypen.map((t, i) => (<View key={i} style={{width: colWidth, alignItems: 'center'}}><View style={[styles.miniBox, {backgroundColor: t.c, width: 26}]}><Text style={styles.miniBoxTxt}>{t.l}</Text></View></View>))}
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
        </ScrollView>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]}>
      <StatusBar translucent backgroundColor="transparent" barStyle={isDarkMode ? "light-content" : "dark-content"} />
      <View style={[styles.header, {backgroundColor: theme.head}]}>
        <View style={{width: 50}} />
        <Text style={styles.hTitle}>Planer Nano Pro</Text>
        <TouchableOpacity style={styles.hBtn} onPress={() => setIsDarkMode(!isDarkMode)}><Ionicons name={isDarkMode ? "sunny" : "moon"} size={22} color="white" /></TouchableOpacity>
      </View>

      {activeTab === 'Tabelle' ? (
        <View style={{flex: 1}}>
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
          <ScrollView style={{flex: 1}} contentContainerStyle={{paddingBottom: 150}}>
            <View style={{flexDirection: 'row'}}>
              <View>
                {shifts.map((s, i) => {
                  const ft = isHessenFeiertag(s.datum);
                  const isNewM = i === 0 || s.datum.split('.')[1] !== shifts[i-1].datum.split('.')[1];
                  return (
                    <View key={s.id}>
                      {isNewM && <View style={styles.monthLabel}><Text style={styles.monthLabelTxt}>{monate[parseInt(s.datum.split('.')[1])-1]}</Text></View>}
                      <View style={[styles.sideCell, {borderBottomColor: theme.bor, backgroundColor: ft ? (isDarkMode ? '#3d1010' : '#ffebee') : 'transparent'}]}>
                        <Text style={[styles.tagTxt, {color: (s.tag==='Sa'||s.tag==='So'||ft) ? '#e91e63' : theme.txt}]}>{s.tag}</Text>
                        <Text style={styles.dateTxt}>{s.datum.split('.')[0]}.</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
              <ScrollView horizontal onScroll={(e) => headerScrollRef.current?.scrollTo({x: e.nativeEvent.contentOffset.x, animated: false})} scrollEventThrottle={16}>
                <View>
                  {shifts.map((s, i) => {
                    const isNewM = i === 0 || s.datum.split('.')[1] !== shifts[i-1].datum.split('.')[1];
                    return (
                      <View key={s.id}>
                        {isNewM && <View style={[styles.monthLabel, {width: personKeys.length * 60}]} />}
                        <View style={{flexDirection: 'row'}}>
                          {personKeys.map(pk => (
                            <TouchableOpacity key={pk} style={[styles.cell, {backgroundColor: s[pk+'Col'], borderBottomColor: theme.bor}]} onPress={() => { setSelectedCell({rowId: s.id, pk}); setModalVisible(true); }}>
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
          <View style={styles.fabContainer}>
              <TouchableOpacity style={[styles.fabSmall, {backgroundColor: theme.sub}]} onPress={addDayPast}><Ionicons name="arrow-up" size={20} color="white" /></TouchableOpacity>
              <TouchableOpacity style={[styles.fab, {backgroundColor: theme.acc}]} onPress={addDayFuture}><Ionicons name="add" size={30} color="white" /></TouchableOpacity>
          </View>
        </View>
      ) : renderStatistik()}

      <View style={[styles.tabBar, {backgroundColor: theme.card, borderTopColor: theme.bor}]}>
        <TouchableOpacity style={styles.tab} onPress={() => setActiveTab('Tabelle')}><Ionicons name="grid" size={22} color={activeTab === 'Tabelle' ? theme.acc : '#888'} /><Text style={{fontSize: 10, color: activeTab === 'Tabelle' ? theme.acc : '#888', marginTop: 4}}>Tabelle</Text></TouchableOpacity>
        <TouchableOpacity style={styles.tab} onPress={() => setActiveTab('Statistik')}><Ionicons name="stats-chart" size={22} color={activeTab === 'Statistik' ? theme.acc : '#888'} /><Text style={{fontSize: 10, color: activeTab === 'Statistik' ? theme.acc : '#888', marginTop: 4}}>Statistik</Text></TouchableOpacity>
      </View>

      <Modal visible={rangeModalVisible} transparent animationType="fade">
          <View style={styles.modalBack}><View style={[styles.modalBox, {backgroundColor: theme.card, height: '70%'}]}>
              <ScrollView>{shifts.map((s, idx) => (
                  <TouchableOpacity key={s.id} style={[styles.rangeItem, {borderBottomColor: theme.bor}]} onPress={() => {
                      if (selectingType === 'start') { if (idx > rangeEndIdx) setRangeEndIdx(idx); setRangeStartIdx(idx); } 
                      else { if (idx < rangeStartIdx) setRangeStartIdx(idx); setRangeEndIdx(idx); }
                      setRangeModalVisible(false);
                  }}><Text style={{color: theme.txt, fontSize: 16}}>{s.datum} ({s.tag})</Text></TouchableOpacity>
              ))}</ScrollView>
          </View></View>
      </Modal>

      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalBack}><View style={[styles.modalBox, {backgroundColor: theme.card}]}>
            <View style={styles.modalGrid}>
                {schichtTypen.map((s, i) => (<TouchableOpacity key={i} style={[styles.opt, {backgroundColor: s.c, borderRadius: 12}]} onPress={() => { setShifts(shifts.map(r => r.id === selectedCell.rowId ? {...r, [selectedCell.pk]: s.l, [selectedCell.pk+'Col']: s.c} : r)); setModalVisible(false); }}><Text style={{color: 'white', fontWeight: 'bold'}}>{s.l}</Text></TouchableOpacity>))}
                <TouchableOpacity style={[styles.opt, {backgroundColor: isDarkMode ? '#2c2c2c' : '#f0f0f0', borderRadius: 12, borderWidth: 1, borderColor: isDarkMode ? '#444' : '#ddd'}]} onPress={() => { setShifts(shifts.map(r => r.id === selectedCell.rowId ? {...r, [selectedCell.pk]: '--', [selectedCell.pk+'Col']: 'transparent'} : r)); setModalVisible(false); }}><Ionicons name="remove-circle-outline" size={20} color={isDarkMode ? '#aaa' : '#888'} /><Text style={{color: isDarkMode ? '#aaa' : '#888', fontSize: 10}}>FREI</Text></TouchableOpacity>
            </View>
            <TouchableOpacity onPress={() => setModalVisible(false)} style={{marginTop: 20}}><Text style={{color: theme.acc, textAlign: 'center'}}>Schließen</Text></TouchableOpacity>
        </View></View>
      </Modal>

      <Modal visible={nameModalVisible} transparent animationType="slide">
        <View style={styles.modalBack}><View style={[styles.modalBox, {backgroundColor: theme.card}]}>
          <TextInput style={[styles.input, {color: theme.txt, borderBottomColor: theme.acc}]} value={tempName} onChangeText={setTempName} autoFocus />
          <TouchableOpacity style={[styles.saveBtn, {backgroundColor: theme.acc}]} onPress={() => { setPersonNames({...personNames, [selectedPersonKey]: tempName}); setNameModalVisible(false); }}><Text style={{color: 'white', fontWeight: 'bold'}}>Speichern</Text></TouchableOpacity>
        </View></View>
      </Modal>
    </SafeAreaView>
  );
}

// Build-Trigger: Assets neu laden
const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 50, paddingBottom: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  hBtn: { paddingHorizontal: 15 },
  hTitle: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  headLabel: { color: 'white', fontSize: 10, fontWeight: 'bold' },
  monthLabel: { backgroundColor: '#1a1a1a', height: 30, justifyContent: 'center', paddingLeft: 10 },
  monthLabelTxt: { color: 'white', fontSize: 11, fontWeight: 'bold' },
  sideCell: { width: 55, height: 45, justifyContent: 'center', alignItems: 'center', borderBottomWidth: 1 },
  cell: { width: 60, height: 45, justifyContent: 'center', alignItems: 'center', borderBottomWidth: 1 },
  tagTxt: { fontSize: 12, fontWeight: '600' },
  dateTxt: { fontSize: 10, color: '#999' },
  cellTxt: { fontSize: 12, fontWeight: '600' },
  fabContainer: { position: 'absolute', bottom: 110, right: 20, alignItems: 'center' },
  fab: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', elevation: 8 },
  fabSmall: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center', elevation: 6, marginBottom: 12 },
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
  modalBack: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center' },
  modalBox: { width: '85%', padding: 25, borderRadius: 24 },
  modalGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  opt: { width: '28%', aspectRatio: 1, margin: 8, justifyContent: 'center', alignItems: 'center' },
  input: { borderBottomWidth: 2, fontSize: 22, textAlign: 'center', marginBottom: 30 },
  saveBtn: { padding: 16, borderRadius: 14, alignItems: 'center' },
  rangeItem: { padding: 18, borderBottomWidth: 0.5 },
  backupInput: { height: 80, borderWidth: 1, borderRadius: 12, padding: 10, fontSize: 10, textAlignVertical: 'top' },
  backupBtn: { padding: 12, borderRadius: 10, flex: 0.48, alignItems: 'center' },
  btnTxt: { color: 'white', fontWeight: 'bold', fontSize: 11 }
});
