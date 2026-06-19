import React, { useState, useEffect, useRef, useMemo } from 'react';

import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Modal, TextInput, StatusBar, SafeAreaView, Alert, Share, Clipboard } from 'react-native';

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

      ...Object.fromEntries(personKeys.map(k => [k, '—'])),

      ...Object.fromEntries(personKeys.map(k => [k + 'Col', 'transparent'])),

      // Zusätzliche persistent Felder für manuelle Überschreibungen in „Mein Plan“

      customStart_p1: null,

      customEnd_p1: null,

      customPause_p1: null,

      customLabel_p1: null,

      customColor_p1: null

    });

  }

  return yearData;

};

 

export default function App() {

  // Start-Tab ist 'MeinPlan'

  const [activeTab, setActiveTab] = useState('MeinPlan');

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

  const [selectedMonthFilter, setSelectedMonthFilter] = useState(''); // Format: „MM.YYYY“ oder leer für aktuell

 

  // Zustände für frei konfigurierbare manuelle Schichten im Modal

  const [customLabel, setCustomLabel] = useState('');

  const [customColor, setCustomColor] = useState('#D81B60');

 

  // Zustände für den Schicht-Kopier-Modus

  const [copyModeActive, setCopyModeActive] = useState(false);

  const [copiedValue, setCopiedValue] = useState(null); // { label: '…', color: '…' }

 

  // Eingegebene Soll-Stunden pro Monat

  const [sollStunden, setSollStunden] = useState('');

  const [sollNachtStunden, setSollNachtStunden] = useState('');

 

  // Urlaubs-Zustände für P1

  const [maxUrlaubstageAktuell, setMaxUrlaubstageAktuell] = useState('30');

  const [maxUrlaubstageFolgejahr, setMaxUrlaubstageFolgejahr] = useState('30');

  const [urlaubGueltigkeit, setUrlaubGueltigkeit] = useState({}); // Mapping von shift.id -> 'aktuell' | 'folgejahr'

  const [urlaubModalVisible, setUrlaubModalVisible] = useState(false);

  const [pendingUrlaubCell, setPendingUrlaubCell] = useState(null);

 

  // Schichtfarben für die Erstellung manueller Schichten (Eindeutig voneinander unterscheidbar)

  const customColorPalette = [

    '#D81B60', '#1E88E5', '#E65100', '#2E7D32', '#6A1B9A', 

    '#F57F17', '#00838F', '#455A64', '#8D6E63', '#EC407A', '#558B2F'

  ];

 

  const initialNames = { p1: 'P1', p2: 'P2', p3: 'P3', p4: 'P4', p5: 'P5', p6: 'P6', p7: 'P7', p8: 'P8', p9: 'P9', p10: 'P10' };

  const [personNames, setPersonNames] = useState(initialNames);

  const personKeys = Object.keys(initialNames);

  const monate = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

 

  // Vordefinierte Schichten - Farben optimiert auf dunklere Pastelltöne / gedämpfte Farben für bessere Lesbarkeit

  const [schichtTypen, setSchichtTypen] = useState([

    {l:'SV',  c:'#C62828', s:'06:00', e:'14:00', p:'30'},  // Dunkelrot

    {l:'PDI', c:'#2E7D32', s:'06:00', e:'14:00', p:'30'},  // Dunkelgrün

    {l:'QS',  c:'#EF6C00', s:'07:00', e:'15:30', p:'30'},  // Dunkelorange/Bernstein (besser lesbar als helles Gelb)

    {l:'STL', c:'#1565C0', s:'07:00', e:'15:30', p:'30'},  // Dunkelblau

    {l:'FHR', c:'#6A1B9A', s:'07:00', e:'15:30', p:'30'},  // Tiefes Lila

    {l:'FD',  c:'#4A148C', s:'06:00', e:'14:30', p:'30'},  // Dunkellila

    {l:'SD',  c:'#00838F', s:'13:30', e:'22:00', p:'30'},  // Dunkles Cyan/Teal

    {l:'QC',  c:'#AD1457', s:'07:00', e:'15:30', p:'30'},  // Dunkles Magenta/Pink

    {l:'TS',  c:'#64DD17', s:'07:30', e:'16:00', p:'30'},  // Kräftiges Limettengrün

    {l:'HRS', c:'#EC407A', s:'08:00', e:'16:30', p:'30'}   // Ruhiges Altrosa

  ]);

 

  // Zustand für die Bearbeitung von Schichtzeiten im Modal

  const [editingSchichtIdx, setEditingSchichtIdx] = useState(null);

  const [editStartTime, setEditStartTime] = useState('');

  const [editEndTime, setEditEndTime] = useState('');

  const [editPauseTime, setEditPauseTime] = useState('');

 

  // Zustände für das manuelle Editieren eines einzelnen Tages in „Mein Plan“

  const [myPlanModalVisible, setMyPlanModalVisible] = useState(false);

  const [myPlanSelectedDay, setMyPlanSelectedDay] = useState(null);

  const [myPlanEditLabel, setMyPlanEditLabel] = useState('');

  const [myPlanEditStart, setMyPlanEditStart] = useState('');

  const [myPlanEditEnd, setMyPlanEditEnd] = useState('');

  const [myPlanEditPause, setMyPlanEditPause] = useState('');

 

  // Referenzen für TextInput Loops (Fokus-Schnittstellen)

  const editEndRef = useRef(null);

  const editPauseRef = useRef(null);

  const myPlanEndRef = useRef(null);

  const myPlanPauseRef = useRef(null);

 

  // Generische Zeitformatierung für HHMM -> HH:MM mit automatischem Fokus-Wechsel

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

    const jahr = parseInt(datumStr.split('.')[2]);

    const feiertage = getHessenFeiertage(jahr);

    return feiertage[datumStr] ? feiertage[datumStr].code : null;

  };

 

  const getHessenFeiertagName = (datumStr) => {

    const jahr = parseInt(datumStr.split('.')[2]);

    const feiertage = getHessenFeiertage(jahr);

    return feiertage[datumStr] ? feiertage[datumStr].name : null;

  };

 

  const [shifts, setShifts] = useState(() => generateYear2026(Object.keys(initialNames)));

 

  // Hilfsmapping zur dynamischen Berechnung der URL-Nummerierung für P1

  const urlaubNummerierung = useMemo(() => {

    let indexAktuell = 1;

    let indexFolgejahr = 1;

    const mapping = {};

 

    shifts.forEach(s => {

      const isUrlaub = s.p1 === 'URL' || (s.customLabel_p1 && s.customLabel_p1.trim().toUpperCase() === 'URL');

      const isArbeitstag = s.tag !== 'Sa' && s.tag !== 'So';

      const istFeiertag = isHessenFeiertag(s.datum) !== null;

 

      if (isUrlaub) {

        if (isArbeitstag && !istFeiertag) {

          const gueltigkeit = urlaubGueltigkeit[s.id] || 'aktuell';

          if (gueltigkeit === 'aktuell') {

            mapping[s.id] = `URL${indexAktuell++}`;

          } else {

            mapping[s.id] = `URL${indexFolgejahr++}`;

          }

        } else {

          mapping[s.id] = 'URL';

        }

      }

    });

 

    return {

      mapping,

      gesamtAktuell: indexAktuell - 1,

      gesamtFolgejahr: indexFolgejahr - 1

    };

  }, [shifts, urlaubGueltigkeit]);

 

  const headerScrollRef = useRef(null);

  const mainVerticalScrollRef = useRef(null);

  const myPlanVerticalScrollRef = useRef(null);

  const rowHeights = useRef({});

 

  useEffect(() => { loadData(); }, []);

  

  useEffect(() => { 

    saveData(); 

    if (rangeEndIdx === 0 && shifts.length > 0) setRangeEndIdx(shifts.length - 1);

  }, [shifts, personNames, isDarkMode, schichtTypen, sollStunden, sollNachtStunden, maxUrlaubstageAktuell, maxUrlaubstageFolgejahr, urlaubGueltigkeit]);

 

  useEffect(() => {

    if (activeTab === 'Schichten' && shifts.length > 0) {

      const timer = setTimeout(() => {

        jumpToCurrentDay(); 

      }, 50);

      return () => clearTimeout(timer);

    }

    if (activeTab === 'MeinPlan' && shifts.length > 0) {

      const timer = setTimeout(() => {

        jumpToCurrentDayMyPlan(); 

      }, 50);

      return () => clearTimeout(timer);

    }

  }, [activeTab, selectedMonthFilter]);

 

  const saveData = async () => {

    try { 

      await AsyncStorage.setItem('@planer_nano_final_v5', JSON.stringify({

        shifts, personNames, isDarkMode, schichtTypen, sollStunden, sollNachtStunden,

        maxUrlaubstageAktuell, maxUrlaubstageFolgejahr, urlaubGueltigkeit

      })); 

    } catch (e) {}

  };

 

  const loadData = async () => {

    try {

      const saved = await AsyncStorage.getItem('@planer_nano_final_v5');

      if (saved) {

        const parsed = JSON.parse(saved);

        if (parsed?.shifts && parsed.shifts.length > 0) { 

          const migratedShifts = parsed.shifts.map(s => ({

            ...s,

            customStart_p1: s.customStart_p1 !== undefined ? s.customStart_p1 : null,

            customEnd_p1: s.customEnd_p1 !== undefined ? s.customEnd_p1 : null,

            customPause_p1: s.customPause_p1 !== undefined ? s.customPause_p1 : null,

            customLabel_p1: s.customLabel_p1 !== undefined ? s.customLabel_p1 : null,

            customColor_p1: s.customColor_p1 !== undefined ? s.customColor_p1 : null,

          }));

          setShifts(migratedShifts); 

          setRangeEndIdx(migratedShifts.length - 1); 

        }

        if (parsed?.personNames) setPersonNames(parsed.personNames);

        if (parsed?.isDarkMode !== undefined) setIsDarkMode(parsed.isDarkMode);

        if (parsed?.schichtTypen) setSchichtTypen(parsed.schichtTypen);

        if (parsed?.sollStunden !== undefined) setSollStunden(parsed.sollStunden);

        if (parsed?.sollNachtStunden !== undefined) setSollNachtStunden(parsed.sollNachtStunden);

        if (parsed?.maxUrlaubstageAktuell !== undefined) setMaxUrlaubstageAktuell(parsed.maxUrlaubstageAktuell);

        if (parsed?.maxUrlaubstageFolgejahr !== undefined) setMaxUrlaubstageFolgejahr(parsed.maxUrlaubstageFolgejahr);

        if (parsed?.urlaubGueltigkeit !== undefined) setUrlaubGueltigkeit(parsed.urlaubGueltigkeit);

      }

    } catch (e) {}

  };

 

  const handleExport = async () => {

    try {

      const exportPayload = { 

        shifts, 

        personNames, 

        isDarkMode, 

        schichtTypen, 

        sollStunden, 

        sollNachtStunden,

        maxUrlaubstageAktuell,

        maxUrlaubstageFolgejahr,

        urlaubGueltigkeit

      };

      

      const dataString = JSON.stringify(exportPayload);

      

      const result = await Share.share({

        message: dataString,

        title: 'Schichtplaner Backup'

      });

      

      Clipboard.setString(dataString);

      Alert.alert("Sicherung kopiert", "Der Backup-Code wurde zusätzlich direkt in deine Zwischenablage kopiert!");

    } catch (e) {

      try {

        Clipboard.setString(JSON.stringify({ 

          shifts, personNames, isDarkMode, schichtTypen, sollStunden, sollNachtStunden,

          maxUrlaubstageAktuell, maxUrlaubstageFolgejahr, urlaubGueltigkeit

        }));

        Alert.alert("Export", "Backup-Code wurde direkt in die Zwischenablage kopiert (Teilen-Dialog nicht verfügbar).");

      } catch (err) {

        Alert.alert("Fehler", "Export konnte nicht durchgeführt werden.");

      }

    }

  };

 

  const handleImport = async () => {

    const trimmedInput = backupInput ? backupInput.trim() : '';

    if (!trimmedInput) { 

      Alert.alert("Hinweis", "Bitte füge zuerst einen gültigen Backup-Code in das Textfeld ein."); 

      return; 

    }

    

    try {

      const parsed = JSON.parse(trimmedInput);

      

      if (!parsed || !parsed.shifts || !Array.isArray(parsed.shifts)) {

        Alert.alert("Fehler", "Ungültiges Datenformat. Der Code enthält keine kompatiblen Schichtdaten.");

        return;

      }

      

      setShifts(parsed.shifts);

      if (parsed.personNames) setPersonNames(parsed.personNames);

      if (parsed.schichtTypen) setSchichtTypen(parsed.schichtTypen);

      if (parsed.isDarkMode !== undefined) setIsDarkMode(parsed.isDarkMode);

      if (parsed.sollStunden !== undefined) setSollStunden(parsed.sollStunden);

      if (parsed.sollNachtStunden !== undefined) setSollNachtStunden(parsed.sollNachtStunden);

      if (parsed.maxUrlaubstageAktuell !== undefined) setMaxUrlaubstageAktuell(parsed.maxUrlaubstageAktuell);

      if (parsed.maxUrlaubstageFolgejahr !== undefined) setMaxUrlaubstageFolgejahr(parsed.maxUrlaubstageFolgejahr);

      if (parsed.urlaubGueltigkeit !== undefined) setUrlaubGueltigkeit(parsed.urlaubGueltigkeit);

      

      setRangeStartIdx(0);

      setRangeEndIdx(parsed.shifts.length - 1);

      

      await AsyncStorage.setItem('@planer_nano_final_v5', JSON.stringify({

        shifts: parsed.shifts,

        personNames: parsed.personNames || personNames,

        isDarkMode: parsed.isDarkMode !== undefined ? parsed.isDarkMode : isDarkMode,

        schichtTypen: parsed.schichtTypen || schichtTypen,

        sollStunden: parsed.sollStunden !== undefined ? parsed.sollStunden : sollStunden,

        sollNachtStunden: parsed.sollNachtStunden !== undefined ? parsed.sollNachtStunden : sollNachtStunden,

        maxUrlaubstageAktuell: parsed.maxUrlaubstageAktuell !== undefined ? parsed.maxUrlaubstageAktuell : maxUrlaubstageAktuell,

        maxUrlaubstageFolgejahr: parsed.maxUrlaubstageFolgejahr !== undefined ? parsed.maxUrlaubstageFolgejahr : maxUrlaubstageFolgejahr,

        urlaubGueltigkeit: parsed.urlaubGueltigkeit !== undefined ? parsed.urlaubGueltigkeit : urlaubGueltigkeit

      }));

 

      setBackupInput('');

      Alert.alert("Erfolg", "Backup erfolgreich importiert und permanent gespeichert!");

    } catch (e) { 

      Alert.alert("Fehler beim Import", "Der eingegebene Code ist fehlerhaft oder unvollständig. Bitte prüfe, ob du den gesamten String kopiert hast."); 

    }

  };

 

  const jumpToCurrentDay = () => {

    let targetIdx = -1;

    if (selectedMonthFilter) {

      targetIdx = currentMonthShifts.findIndex(s => s.datum.endsWith(selectedMonthFilter));

    } else {

      const today = new Date();

      const tag = String(today.getDate()).padStart(2, '0');

      const monat = String(today.getMonth() + 1).padStart(2, '0');

      const heuteStr2026 = `${tag}.${monat}.2026`;

      targetIdx = currentMonthShifts.findIndex(s => s.datum === heuteStr2026);

      

      if (targetIdx === -1) {

        const aktuellerMonat2026 = `${monat}.2026`;

        targetIdx = currentMonthShifts.findIndex(s => s.datum.endsWith(aktuellerMonat2026));

      }

    }

    

    if (targetIdx !== -1 && mainVerticalScrollRef.current) {

      let estimatedY = 0;

      let lastMonth = null;

 

      for (let i = 0; i < targetIdx; i++) {

        const currentItemMonth = currentMonthShifts[i].datum.split('.')[1];

        if (lastMonth === null || currentItemMonth !== lastMonth) {

          estimatedY += 30; 

          lastMonth = currentItemMonth;

        }

        estimatedY += 45; 

      }

 

      const targetItemMonth = currentMonthShifts[targetIdx].datum.split('.')[1];

      if (lastMonth === null || targetItemMonth !== lastMonth) {

        estimatedY += 30; 

      }

 

      mainVerticalScrollRef.current.scrollTo({ y: estimatedY, animated: false });

    }

  };

 

  const jumpToCurrentDayMyPlan = () => {

    let targetIdx = -1;

    if (selectedMonthFilter) {

      targetIdx = currentMonthShifts.findIndex(s => s.datum.endsWith(selectedMonthFilter));

    } else {

      const today = new Date();

      const tag = String(today.getDate()).padStart(2, '0');

      const monat = String(today.getMonth() + 1).padStart(2, '0');

      const heuteStr2026 = `${tag}.${monat}.2026`;

      targetIdx = currentMonthShifts.findIndex(s => s.datum === heuteStr2026);

      

      if (targetIdx === -1) {

        const aktuellerMonat2026 = `${monat}.2026`;

        targetIdx = currentMonthShifts.findIndex(s => s.datum.endsWith(aktuellerMonat2026));

      }

    }

    

    if (targetIdx !== -1 && myPlanVerticalScrollRef.current) {

      let estimatedY = targetIdx * 41.5; 

      myPlanVerticalScrollRef.current.scrollTo({ y: estimatedY, animated: false });

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

    const labelUpper = customLabel.trim().toUpperCase();

 

    if (selectedCell.pk === 'p1' && labelUpper === 'URL') {

      setModalVisible(false);

      setPendingUrlaubCell({ rowId: selectedCell.rowId, label: 'URL', color: '#00bcd4' });

      setUrlaubModalVisible(true);

      return;

    }

 

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

 

  // KORRIGIERT: Ermöglicht nun auch das Kopieren von freien Schichten ('—')

  const handleCellPress = (rowId, pk, currentLabel, currentColor) => {

    if (copyModeActive) {

      if (!copiedValue) {

        // Freie Schichten können nun ohne Blockierung als Kopiermuster übernommen werden

        setCopiedValue({ label: currentLabel, color: currentColor });

      } else {

        if (pk === 'p1' && copiedValue.label === 'URL') {

          setPendingUrlaubCell({ rowId, label: 'URL', color: '#00bcd4' });

          setUrlaubModalVisible(true);

          return;

        }

 

        // Falls eine freie Schicht auf P1 kopiert wird, müssen etwaige Urlaubs-Gültigkeitsmappings bereinigt werden

        if (pk === 'p1' && copiedValue.label === '—') {

          if (urlaubGueltigkeit[rowId]) {

            const updatedGueltigkeit = { ...urlaubGueltigkeit };

            delete updatedGueltigkeit[rowId];

            setUrlaubGueltigkeit(updatedGueltigkeit);

          }

        }

 

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

 

  const handleSelectUrlaubGueltigkeit = (gueltigkeit) => {

    if (!pendingUrlaubCell) return;

    const { rowId, label, color } = pendingUrlaubCell;

 

    setUrlaubGueltigkeit(prev => ({ ...prev, [rowId]: gueltigkeit }));

    setShifts(shifts.map(r => r.id === rowId ? { ...r, p1: label, p1Col: color } : r));

    

    if (copyModeActive) {

      setCopiedValue({ label: label, color: color });

    }

 

    setUrlaubModalVisible(false);

    setPendingUrlaubCell(null);

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

 

  const openMyPlanEditModal = (day) => {

    setMyPlanSelectedDay(day);

    setMyPlanEditLabel(day.customLabel_p1 !== null ? day.customLabel_p1 : (day.p1 !== '—' ? day.p1 : ''));

    setMyPlanEditStart('');

    setMyPlanEditEnd('');

    setMyPlanEditPause('');

    setMyPlanModalVisible(true);

  };

 

  const saveMyPlanDayChanges = () => {

    if (!myPlanSelectedDay) return;

    const labelUpper = myPlanEditLabel.trim().toUpperCase();

 

    if (labelUpper === 'URL') {

      setMyPlanModalVisible(false);

      setPendingUrlaubCell({ rowId: myPlanSelectedDay.id, label: 'URL', color: '#00bcd4' });

      setUrlaubModalVisible(true);

      return;

    }

 

    setShifts(shifts.map(s => {

      if (s.id === myPlanSelectedDay.id) {

        const currentGlobal = schichtTypen.find(t => t.l === labelUpper);

        

        const targetColor = labelUpper === 'URL' 

          ? '#00bcd4'

          : (labelUpper ? (currentGlobal ? currentGlobal.c : customColor) : 'transparent');

 

        return {

          ...s,

          p1: labelUpper || '—',

          p1Col: targetColor,

          customLabel_p1: myPlanEditLabel.trim() || null,

          customStart_p1: myPlanEditStart.trim() || (currentGlobal ? currentGlobal.s : null),

          customEnd_p1: myPlanEditEnd.trim() || (currentGlobal ? currentGlobal.e : null),

          customPause_p1: myPlanEditPause.trim() || (currentGlobal ? currentGlobal.p : null),

          customColor_p1: myPlanEditLabel.trim() ? targetColor : null

        };

      }

      return s;

    }));

    setMyPlanModalVisible(false);

    setMyPlanSelectedDay(null);

  };

 

  const resetMyPlanDayChanges = () => {

    if (!myPlanSelectedDay) return;

    if (urlaubGueltigkeit[myPlanSelectedDay.id]) {

      const updatedGueltigkeit = { ...urlaubGueltigkeit };

      delete updatedGueltigkeit[myPlanSelectedDay.id];

      setUrlaubGueltigkeit(updatedGueltigkeit);

    }

 

    setShifts(shifts.map(s => {

      if (s.id === myPlanSelectedDay.id) {

        return {

          ...s,

          p1: '—',

          p1Col: 'transparent',

          customLabel_p1: null,

          customStart_p1: null,

          customEnd_p1: null,

          customPause_p1: null,

          customColor_p1: null

        };

      }

      return s;

    }));

    setMyPlanModalVisible(false);

    setMyPlanSelectedDay(null);

  };

 

  const calculateMyPlanStats = useMemo(() => {

    let totalMinutes = 0;

    let totalNightMinutes = 0;

    let totalFeiertagMinutes = 0;

    let totalSickMinutes = 0;

 

    currentMonthShifts.forEach(s => {

      const globalSchicht = schichtTypen.find(t => t.l === s.p1);

      const startStr = s.customStart_p1 !== null ? s.customStart_p1 : (globalSchicht ? globalSchicht.s : '');

      const endStr = s.customEnd_p1 !== null ? s.customEnd_p1 : (globalSchicht ? globalSchicht.e : '');

      const pauseStr = s.customPause_p1 !== null ? s.customPause_p1 : (globalSchicht ? globalSchicht.p : '0');

 

      if (s.p1Col === 'krank') {

        if (!startStr || !endStr) return;

        const [sH, sM] = startStr.split(':').map(Number);

        const [eH, eM] = endStr.split(':').map(Number);

        const pauseMin = parseInt(pauseStr) || 0;

        if (isNaN(sH) || isNaN(sM) || isNaN(eH) || isNaN(eM)) return;

 

        let startMin = sH * 60 + sM;

        let endMin = eH * 60 + eM;

        if (endMin < startMin) endMin += 24 * 60;

        

        const grossMinutes = endMin - startMin;

        const netMinutes = Math.max(0, grossMinutes - pauseMin);

        totalSickMinutes += netMinutes;

        return;

      }

 

      const label = s.customLabel_p1 !== null ? s.customLabel_p1 : s.p1;

      if (label === '—' || !label) return;

 

      if (!startStr || !endStr) return;

 

      const [sH, sM] = startStr.split(':').map(Number);

      const [eH, eM] = endStr.split(':').map(Number);

      const pauseMin = parseInt(pauseStr) || 0;

 

      if (isNaN(sH) || isNaN(sM) || isNaN(eH) || isNaN(eM)) return;

 

      let startMin = sH * 60 + sM;

      let endMin = eH * 60 + eM;

 

      if (endMin < startMin) {

        endMin += 24 * 60;

      }

 

      const grossMinutes = endMin - startMin;

      const netMinutes = Math.max(0, grossMinutes - pauseMin);

      totalMinutes += netMinutes;

 

      const ft = isHessenFeiertag(s.datum);

      if (ft && s.tag !== 'Sa' && s.tag !== 'So') {

        totalFeiertagMinutes += netMinutes;

      }

 

      const night1Start = Math.max(startMin, 22 * 60);

      const night1End = Math.min(endMin, 24 * 60);

      let nightMinutes = Math.max(0, night1End - night1Start);

 

      const night2Start = Math.max(startMin, 24 * 60);

      const night2End = Math.min(endMin, 30 * 60);

      nightMinutes += Math.max(0, night2End - night2Start);

 

      const night3Start = startMin;

      const night3End = Math.min(endMin, 6 * 60);

      nightMinutes += Math.max(0, night3End - night3Start);

 

      totalNightMinutes += nightMinutes;

    });

 

    const currentActualHours = totalMinutes / 60;

    const parsedSollHours = parseFloat(sollStunden.replace(',', '.')) || 0;

    const diffHours = currentActualHours - parsedSollHours;

 

    let statusIcon = 'checkmark-circle';

    let statusColor = '#2ecc71'; 

    if (parsedSollHours > 0) {

      if (currentActualHours > parsedSollHours + 0.01) {

        statusIcon = 'arrow-up-circle';

        statusColor = '#2ecc71'; 

      } else if (currentActualHours < parsedSollHours - 0.01) {

        statusIcon = 'arrow-down-circle';

        statusColor = '#e91e63'; 

      }

    }

 

    const currentFeiertagHours = totalFeiertagMinutes / 60;

    const currentSickHours = totalSickMinutes / 60;

 

    return {

      hours: currentActualHours.toFixed(2),

      nightHours: (totalNightMinutes / 60).toFixed(2),

      feiertagHours: currentFeiertagHours.toFixed(2),

      sickHours: currentSickHours.toFixed(2),

      diffHours: diffHours.toFixed(2),

      hasSoll: parsedSollHours > 0,

      statusIcon,

      statusColor

    };

  }, [currentMonthShifts, schichtTypen, sollStunden]);

 

  const renderMeinPlan = () => {

    return (

      <View style={{ flex: 1 }}>

        <View style={[styles.searchFilterContainer, { backgroundColor: theme.card, borderBottomColor: theme.bor }]}>

          <TouchableOpacity style={styles.searchBarButton} onPress={() => setSearchModalVisible(true)}>

            <Ionicons name="search-outline" size={16} color={theme.acc} style={{ marginRight: 8 }} />

            <Text style={[styles.searchText, { color: theme.txt }]}>

              Monat wechseln: <Text style={{ color: theme.acc, fontWeight: 'bold' }}>{filterDisplayTitle}</Text>

            </Text>

          </TouchableOpacity>

          {selectedMonthFilter !== '' && (

            <TouchableOpacity style={styles.clearFilterBtn} onPress={() => setSelectedMonthFilter('')}>

              <Ionicons name="close-circle" size={18} color="#e91e63" />

            </TouchableOpacity>

          )}

        </View>

 

        <View style={styles.modernStatsDashboardGrid}>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modernDashboardRow}>

            

            <View style={[styles.modernStatTileVertical, { backgroundColor: theme.card, borderColor: theme.bor }]}>

              <View style={styles.modernTileHeader}>

                <View style={[styles.modernIconBadge, { backgroundColor: 'rgba(25, 118, 210, 0.1)' }]}>

                  <Ionicons name="time" size={16} color={theme.acc} />

                </View>

                <Text style={styles.modernTileLabel} numberOfLines={1}>Arbeitszeit ({personNames.p1})</Text>

              </View>

              <View style={styles.modernMainRow}>

                <Text style={[styles.modernValueHighlight, { color: theme.acc }]}>{calculateMyPlanStats.hours}</Text>

                <Text style={[styles.modernUnit, { color: theme.sub }]}>Std. Ist</Text>

              </View>

              {calculateMyPlanStats.hasSoll ? (

                <View style={[

                  styles.modernBadgeDiff, 

                  { backgroundColor: parseFloat(calculateMyPlanStats.diffHours) >= 0 ? 'rgba(46, 125, 50, 0.12)' : 'rgba(194, 24, 91, 0.12)' }

                ]}>

                  <Ionicons 

                    name={parseFloat(calculateMyPlanStats.diffHours) >= 0 ? "add-circle" : "remove-circle"} 

                    size={11} 

                    color={parseFloat(calculateMyPlanStats.diffHours) >= 0 ? '#2e7d32' : '#c2185b'} 

                    style={{ marginRight: 2 }}

                  />

                  <Text style={[styles.modernBadgeDiffText, { color: parseFloat(calculateMyPlanStats.diffHours) >= 0 ? '#2e7d32' : '#c2185b' }]}>

                    {parseFloat(calculateMyPlanStats.diffHours) >= 0 ? '+' : ''}{calculateMyPlanStats.diffHours} Std.

                  </Text>

                </View>

              ) : (

                <View style={styles.modernBadgeSpacePlaceholder} />

              )}

            </View>

            

            <View style={[styles.modernStatTileVertical, { backgroundColor: theme.card, borderColor: theme.bor }]}>

              <View style={styles.modernTileHeader}>

                <View style={[styles.modernIconBadge, { backgroundColor: 'rgba(255, 152, 0, 0.1)' }]}>

                  <Ionicons name="moon" size={15} color="#ff9800" />

                </View>

                <Text style={styles.modernTileLabel} numberOfLines={1}>Nachtzuschlag</Text>

              </View>

              <View style={styles.modernMainRow}>

                <Text style={[styles.modernValueHighlight, { color: '#ff9800' }]}>{calculateMyPlanStats.nightHours}</Text>

                <Text style={[styles.modernUnit, { color: theme.sub }]}>Std. ges.</Text>

              </View>

              <View style={styles.modernBadgeSpacePlaceholder} />

            </View>

 

            <View style={[styles.modernStatTileVertical, { backgroundColor: theme.card, borderColor: theme.bor }]}>

              <View style={styles.modernTileHeader}>

                <View style={[styles.modernIconBadge, { backgroundColor: 'rgba(76, 175, 80, 0.1)' }]}>

                  <Ionicons name="ribbon" size={15} color="#4caf50" />

                </View>

                <Text style={styles.modernTileLabel} numberOfLines={1}>Feiertagszeit</Text>

              </View>

              <View style={styles.modernMainRow}>

                <Text style={[styles.modernValueHighlight, { color: '#4caf50' }]}>{calculateMyPlanStats.feiertagHours}</Text>

                <Text style={[styles.modernUnit, { color: theme.sub }]}>Std.</Text>

              </View>

              <View style={styles.modernBadgeSpacePlaceholder} />

            </View>

 

            <View style={[styles.modernStatTileVertical, { backgroundColor: theme.card, borderColor: theme.bor }]}>

              <View style={styles.modernTileHeader}>

                <View style={[styles.modernIconBadge, { backgroundColor: 'rgba(233, 30, 99, 0.1)' }]}>

                  <Ionicons name="medkit" size={15} color="#e91e63" />

                </View>

                <Text style={styles.modernTileLabel} numberOfLines={1}>Krankheitsstunden</Text>

              </View>

              <View style={styles.modernMainRow}>

                <Text style={[styles.modernValueHighlight, { color: '#e91e63' }]}>{calculateMyPlanStats.sickHours}</Text>

                <Text style={[styles.modernUnit, { color: theme.sub }]}>Std.</Text>

              </View>

              <View style={styles.modernBadgeSpacePlaceholder} />

            </View>

 

            <View style={[styles.modernStatTileVertical, { backgroundColor: theme.card, borderColor: theme.bor, minWidth: 90 }]}>

              <View style={styles.modernTileHeader}>

                <View style={[styles.modernIconBadge, { backgroundColor: 'rgba(25, 118, 210, 0.1)' }]}>

                  <Ionicons name="options" size={15} color={theme.acc} />

                </View>

                <Text style={styles.modernTileLabel} numberOfLines={1}>Sollvorgabe</Text>

              </View>

              <View style={{ flex: 1, justifyContent: 'center', marginTop: 4 }}>

                <View style={styles.modernSollRowElement}>

                  <Text style={[styles.modernSollInlineLabel, { color: theme.sub }]}>Monat:</Text>

                  <TextInput 

                    style={[styles.modernSollInput, { color: theme.txt, backgroundColor: isDarkMode ? '#2c2c2c' : '#f5f5f5', width: 42 }]}

                    keyboardType="numeric"

                    placeholder="0.00"

                    placeholderTextColor="#888"

                    value={sollStunden}

                    onChangeText={setSollStunden}

                  />

                </View>

              </View>

            </View>

 

          </ScrollView>

        </View>

 

        <ScrollView ref={myPlanVerticalScrollRef} style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 150 }}>

          <View style={[styles.matrixCard, { backgroundColor: theme.card, marginHorizontal: 10, marginTop: 5 }]}>

            <View style={[styles.matrixHeader, { borderBottomColor: theme.bor, paddingBottom: 12 }]}>

              <Text style={[styles.myPlanRowHeaderTxt, { color: theme.sub, width: '22%' }]}>DATUM</Text>

              <Text style={[styles.myPlanRowHeaderTxt, { color: theme.sub, width: '20%', textAlign: 'center' }]}>SCHICHT</Text>

              <Text style={[styles.myPlanRowHeaderTxt, { color: theme.sub, width: '40%', textAlign: 'center' }]}>ZEITRAUM (PAUSE)</Text>

              <Text style={[styles.myPlanRowHeaderTxt, { color: theme.sub, width: '18%', textAlign: 'right' }]}>EDIT</Text>

            </View>

 

            {currentMonthShifts.map((s) => {

              const globalSchicht = schichtTypen.find(t => t.l === s.p1);

              const isEdited = s.customLabel_p1 !== null || s.customStart_p1 !== null || s.customEnd_p1 !== null || s.customPause_p1 !== null;

              

              const isSick = s.p1Col === 'krank';

              let label = isSick ? `✚ ${s.p1}` : (s.customLabel_p1 !== null ? s.customLabel_p1 : s.p1);

              

              if (!isSick && (label === 'URL' || s.p1 === 'URL')) {

                label = urlaubNummerierung.mapping[s.id] || 'URL';

              }

 

              const start = s.customStart_p1 !== null ? s.customStart_p1 : (globalSchicht ? globalSchicht.s : '--:--');

              const end = s.customEnd_p1 !== null ? s.customEnd_p1 : (globalSchicht ? globalSchicht.e : '--:--');

              const pause = s.customPause_p1 !== null ? s.customPause_p1 : (globalSchicht ? globalSchicht.p : '0');

              

              const color = isSick 

                ? '#b71c1c' 

                : (s.p1 === 'URL' || label.startsWith('URL') 

                    ? '#00bcd4' 

                    : (s.customColor_p1 !== null ? s.customColor_p1 : (s.p1Col !== 'transparent' ? s.p1Col : (globalSchicht ? globalSchicht.c : 'transparent'))));

              

              const ft = isHessenFeiertag(s.datum);

 

              return (

                <View key={s.id} style={[styles.myPlanRow, { borderBottomColor: theme.bor, backgroundColor: ft ? (isDarkMode ? '#3d1010' : '#ffebee') : 'transparent' }]}>

                  <View style={{ width: '22%', justifyContent: 'center' }}>

                    <Text style={[styles.tagTxt, { color: (s.tag === 'Sa' || s.tag === 'So' || ft) ? '#e91e63' : theme.txt, fontSize: 11 }]}>{s.tag}, {s.datum.split('.')[0]}.{s.datum.split('.')[1]}</Text>

                  </View>

 

                  <View style={{ width: '20%', alignItems: 'center', justifyContent: 'center' }}>

                    <View style={[styles.miniBox, { backgroundColor: color === 'transparent' ? (isDarkMode ? '#333' : '#e0e0e0') : color, paddingHorizontal: 6, minWidth: 42, height: 22, borderRadius: 6 }]}>

                      <Text style={[styles.miniBoxTxt, { color: color === 'transparent' ? theme.txt : 'white', fontSize: 10 }]}>{label}</Text>

                    </View>

                  </View>

 

                  <View style={{ width: '40%', justifyContent: 'center', alignItems: 'center' }}>

                    {label !== '—' ? (

                      <Text style={{ color: theme.txt, fontSize: 11, fontWeight: '500' }}>

                        {start} – {end} <Text style={{ color: theme.sub, fontSize: 9 }}>({pause}m)</Text>

                      </Text>

                    ) : (

                      <Text style={{ color: theme.sub, fontSize: 11 }}>Frei</Text>

                    )}

                  </View>

 

                  <TouchableOpacity style={{ width: '18%', alignItems: 'flex-end', justifyContent: 'center', paddingVertical: 4 }} onPress={() => openMyPlanEditModal(s)}>

                    <Ionicons name={isEdited ? "create" : "create-outline"} size={18} color={isEdited ? '#2ecc71' : theme.acc} />

                  </TouchableOpacity>

                </View>

              );

            })}

          </View>

        </ScrollView>

      </View>

    );

  };

 

  const renderStatistik = () => {

    const colWidth = 26;

 

    const wochentagFeiertage = filteredShifts.filter(s => {

      return s.tag !== 'Sa' && s.tag !== 'So' && isHessenFeiertag(s.datum) !== null;

    });

    const moeglicheFeiertageAnzahl = wochentagFeiertage.length;

 

    const parsedMaxAktuell = parseInt(maxUrlaubstageAktuell) || 0;

    const parsedMaxFolgejahr = parseInt(maxUrlaubstageFolgejahr) || 0;

 

    let abgezogeneTageAktuell = 0;

    let abgezogeneTageFolgejahr = 0;

 

    filteredShifts.forEach(s => {

      const isUrlaub = s.p1 === 'URL' || (s.customLabel_p1 && s.customLabel_p1.trim().toUpperCase() === 'URL');

      const isArbeitstag = s.tag !== 'Sa' && s.tag !== 'So';

      const istFeiertag = isHessenFeiertag(s.datum) !== null;

 

      if (isUrlaub && isArbeitstag && !istFeiertag) {

        const gueltigkeit = urlaubGueltigkeit[s.id] || 'aktuell';

        if (gueltigkeit === 'aktuell') {

          abgezogeneTageAktuell++;

        } else {

          abgezogeneTageFolgejahr++;

        }

      }

    });

 

    const verbleibendAktuell = parsedMaxAktuell - abgezogeneTageAktuell;

    const verbleibendFolgejahr = parsedMaxFolgejahr - abgezogeneTageFolgejahr;

 

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

          

          <View style={styles.statHeader}><Ionicons name="airplane-outline" size={18} color="#00bcd4" /><Text style={[styles.statTitle, {color: theme.txt}]}>Urlaubsstatistik ({personNames.p1})</Text></View>

          <View style={[styles.matrixCard, {backgroundColor: theme.card, marginBottom: 20}]}>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12, alignItems: 'center' }}>

              <Text style={{ color: theme.txt, fontSize: 11, fontWeight: 'bold' }}>Max. Urlaub {2026} (manuell):</Text>

              <TextInput 

                style={[styles.modernSollInput, { color: theme.txt, backgroundColor: isDarkMode ? '#2c2c2c' : '#f5f5f5', width: 50, height: 24, fontSize: 12 }]}

                keyboardType="numeric"

                value={maxUrlaubstageAktuell}

                onChangeText={setMaxUrlaubstageAktuell}

              />

            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15, alignItems: 'center' }}>

              <Text style={{ color: theme.txt, fontSize: 11, fontWeight: 'bold' }}>Max. Urlaub {2027} (manuell):</Text>

              <TextInput 

                style={[styles.modernSollInput, { color: theme.txt, backgroundColor: isDarkMode ? '#2c2c2c' : '#f5f5f5', width: 50, height: 24, fontSize: 12 }]}

                keyboardType="numeric"

                value={maxUrlaubstageFolgejahr}

                onChangeText={setMaxUrlaubstageFolgejahr}

              />

            </View>

            <View style={[styles.devDivider, {backgroundColor: theme.bor}]} />

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 5 }}>

              <View style={{ alignItems: 'center', flex: 0.5 }}>

                <Text style={{ color: theme.sub, fontSize: 10 }}>Genommen (Aktuell / Folge)</Text>

                <Text style={{ color: theme.txt, fontSize: 14, fontWeight: 'bold', marginTop: 4 }}>{abgezogeneTageAktuell} / {abgezogeneTageFolgejahr} Tage</Text>

              </View>

              <View style={{ alignItems: 'center', flex: 0.5 }}>

                <Text style={{ color: theme.sub, fontSize: 10 }}>Verbleibend (Aktuell / Folge)</Text>

                <Text style={{ color: verbleibendAktuell < 0 || verbleibendFolgejahr < 0 ? '#e91e63' : '#4caf50', fontSize: 14, fontWeight: 'bold', marginTop: 4 }}>{verbleibendAktuell} / {verbleibendFolgejahr} Tage</Text>

              </View>

            </View>

          </View>

 

          <View style={styles.statHeader}><Ionicons name="medkit-outline" size={18} color="#b71c1c" /><Text style={[styles.statTitle, {color: theme.txt}]}>Krankheitsstatistik (Tage)</Text></View>

          <View style={[styles.matrixCard, {backgroundColor: theme.card, marginBottom: 20}]}>

            <View style={[styles.matrixHeader, {borderBottomColor: theme.bor}]}>

              <Text style={[styles.matrixNameLabel, {color: theme.sub, width: 120}]}>NAME</Text>

              <View style={{flexDirection: 'row', flex: 1, justifyContent: 'flex-end', paddingRight: 20}}>

                <Text style={[styles.miniBoxTxt, {color: theme.sub, fontWeight: 'bold', fontSize: 9}]}>KRANKHEITSTAGE TOTAL</Text>

              </View>

            </View>

            {personKeys.map(pk => {

              const sickDaysCount = filteredShifts.filter(s => s[pk + 'Col'] === 'krank').length;

              return (

                <View key={pk} style={[styles.matrixRow, {borderBottomColor: theme.bor}]}>

                  <Text style={[styles.matrixName, {color: theme.txt, width: 120}]} numberOfLines={1}>{personNames[pk]}</Text>

                  <View style={{flexDirection: 'row', flex: 1, justifyContent: 'flex-end', paddingRight: 40}}>

                    <Text style={{fontSize: 13, fontWeight: 'bold', color: sickDaysCount > 0 ? '#b71c1c' : theme.sub}}>{sickDaysCount}</Text>

                  </View>

                </View>

              );

            })}

          </View>

 

          <View style={styles.statHeader}><Ionicons name="analytics-outline" size={18} color="#b71c1c" /><Text style={[styles.statTitle, {color: theme.txt}]}>Krankmeldungs-Verteilung nach Schichten (%)</Text></View>

          <View style={[styles.matrixCard, {backgroundColor: theme.card, marginBottom: 20}]}>

            <View style={[styles.matrixHeader, {borderBottomColor: theme.bor}]}>

              <Text style={[styles.matrixNameLabel, {color: theme.sub, width: 55}]}>NAME</Text>

              <View style={{flexDirection: 'row', flex: 1, justifyContent: 'space-between'}}>

                {schichtTypen.map((t, i) => (

                  <View key={i} style={{width: colWidth, justifyContent: 'center'}}>

                    <View style={[styles.miniBox, {backgroundColor: t.c, width: 23}]}>

                      <Text style={styles.miniBoxTxt}>{t.l}</Text>

                    </View>

                  </View>

                ))}

              </View>

            </View>

            {personKeys.map(pk => {

              const sickDays = filteredShifts.filter(s => s[pk + 'Col'] === 'krank');

              const validSickShifts = sickDays.filter(s => schichtTypen.some(t => t.l === s[pk]));

              const totalSickWithShifts = validSickShifts.length;

 

              return (

                <View key={pk} style={[styles.matrixRow, {borderBottomColor: theme.bor}]}>

                  

