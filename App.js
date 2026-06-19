
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

    {l:'SV',  c:'#C62828', s:'06:00', e:'14:00', p:'30'},  // Dunkelrot

    {l:'PDI', c:'#2E7D32', s:'06:00', e:'14:00', p:'30'},  // Dunkelgrün

    {l:'QS',  c:'#EF6C00', s:'07:00', e:'15:30', p:'30'},  // Dunkelorange/Bernstein (besser lesbar als helles Gelb)

    {l:'STL', c:'#1565C0', s:'07:00', e:'15:30', p:'30'},  // Dunkelblau

    {l:'FHR', c:'#6A1B9A', s:'07:00', e:'15:30', p:'30'},  // Tiefes Lila

    {l:'FD',  c:'#4A148C', s:'06:00', e:'14:30', p:'30'},  // Dunkellila

    {l:'SD',  c:'#00838F', s:'13:30', e:'22:00', p:'30'},  // Dunkles Cyan/Teal

    {l:'QC',  c:'#AD1457', s:'07:00', e:'15:30', p:'30'},  // Dunkles Magenta/Pink

    {l:'TS',  c:'#64DD17', s:'07:30', e:'16:00', p:'30'},  // Kräftiges Limettengrün

    {l:'HRS', c:'#EC407A', s:'08:00', e:'16:30', p:'30'}   // Ruhiges Altrosa

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

                  <Text style={[styles.matrixName, {color: theme.txt, width: 55}]} numberOfLines={1}>{personNames[pk]}</Text>

                  <View style={{flexDirection: 'row', flex: 1, justifyContent: 'space-between'}}>

                    {schichtTypen.map((t, i) => {

                      const count = validSickShifts.filter(s => s[pk] === t.l).length;

                      const p = totalSickWithShifts > 0 ? Math.round((count / totalSickWithShifts) * 100) : 0;

                      return (

                        <View key={i} style={{width: colWidth, alignItems: 'center'}}>

                          <Text style={[styles.matrixCellTxt, {color: p > 0 ? theme.txt : '#ccc'}]}>

                            {p > 0 ? `${p}%` : '·'}

                          </Text>

                        </View>

                      );

                    })}

                  </View>

                </View>

              );

            })}

          </View>



          <View style={styles.calendarHeader}><Ionicons name="calendar-outline" size={18} color={theme.acc} /><Text style={[styles.statTitle, {color: theme.txt}]}>Feiertagsstatistik (Mo–Fr) (%)</Text></View>

          <View style={[styles.matrixCard, {backgroundColor: theme.card, marginBottom: 20}]}>

            <View style={[styles.matrixHeader, {borderBottomColor: theme.bor}]}>

              <Text style={[styles.matrixNameLabel, {color: theme.sub, width: 80}]}>NAME</Text>

              <View style={{flexDirection: 'row', flex: 1, justifyContent: 'space-around'}}>

                <Text style={[styles.miniBoxTxt, {color: theme.sub, fontWeight: 'bold', width: 60, textAlign: 'center'}]}>TAGE</Text>

                <Text style={[styles.miniBoxTxt, {color: theme.sub, fontWeight: 'bold', width: 60, textAlign: 'center'}]}>PROZENT</Text>

              </View>

            </View>

            {personKeys.map(pk => {

              const eingeteilteFeiertage = wochentagFeiertage.filter(s => s[pk] !== '—').length;

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

              const total = filteredShifts.filter(s => s[pk] !== '—').length;

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

              filteredShifts.forEach((s, idx) => {

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

                              const common = filteredShifts.filter(s => ((s[p1] === 'SV' && s[p2] === 'PDI') || (s[p1] === 'PDI' && s[p2] === 'SV'))).length;

                              const p1T = filteredShifts.filter(s => (s[p1] === 'SV' || s[p1] === 'PDI')).length;

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



                                  filteredShifts.forEach((s, idx) => {

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

              const saS = filteredShifts.filter(s => s.tag === 'Sa' && s[pk] !== '—');

              const soS = filteredShifts.filter(s => s.tag === 'So' && s[pk] !== '—');

              const saP = saS.length > 0 ? Math.round((saS.filter(s => s[pk] === 'SV').length / saS.length) * 100) : 0;

              const soP = soS.length > 0 ? Math.round((soS.filter(s => s[pk] === 'SV').length / soS.length) * 100) : 0;

              return (

                <View key={pk} style={[styles.matrixRow, {borderBottomColor: theme.bor}]}>

                  <Text style={[styles.matrixName, {color: theme.txt, width: 80}]}>{personNames[pk]}</Text>

                  <View style={{flexDirection: 'row', flex: 1, justifyContent: 'space-around'}}>

                      <Text style={{width: 60, textAlign: 'center', fontSize: 10, color: saS.length > 0 ? theme.txt : '#ddd'}}>{saP}%</Text>

                      <Text style={{width: 60, textAlign: 'center', fontSize: 10, color: soS.length > 0 ? theme.txt : '#ddd'}}>{soP}%</Text>

                  </View>

                </View>

              );

            })}

          </View>



          <View style={[styles.statHeader, {marginTop: 0}]}><Ionicons name="cloud-upload-outline" size={18} color={theme.acc} /><Text style={[styles.statTitle, {color: theme.txt}]}>Datensicherung</Text></View>

          <View style={[styles.matrixCard, {backgroundColor: theme.card, marginBottom: 20}]}>

            <TextInput style={[styles.backupInput, {backgroundColor: isDarkMode ? '#121212' : '#f9f9f9', color: theme.txt, borderColor: theme.bor}]} multiline placeholder="Backup-Code hier einfügen…" placeholderTextColor="#888" value={backupInput} onChangeText={setBackupInput} />

            <View style={{flexDirection: 'row', justifyContent: 'space-between', marginTop: 15}}>

              <TouchableOpacity style={[styles.backupBtn, {backgroundColor: '#4caf50'}]} onPress={handleExport}><Text style={styles.btnTxt}>Senden (Export)</Text></TouchableOpacity>

              <TouchableOpacity style={[styles.backupBtn, {backgroundColor: theme.acc}]} onPress={handleImport}><Text style={styles.btnTxt}>Laden (Import)</Text></TouchableOpacity>

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

              <Ionicons name="copy-outline" size={14} color={copyModeActive ? 'white' : theme.txt} style={{marginRight: 4}} />

              <Text style={[styles.copyModeBtnTxt, { color: copyModeActive ? 'white' : theme.txt }]}>

                {copyModeActive ? 'Kopieren AN' : 'Muster kopieren'}

              </Text>

            </TouchableOpacity>

          </View>



          {copyModeActive && (

            <View style={[styles.copyInfoBar, { backgroundColor: copiedValue ? (copiedValue.color === 'krank' ? '#b71c1c' : copiedValue.color) : '#555' }]}>

              <Text style={styles.copyInfoBarTxt}>

                {copiedValue 

                  ? `Muster [${copiedValue.label}] gewählt. Tippe Zellen zum Einfügen.` 

                  : 'Schritt 1: Tippe eine Tabellenzelle an, deren Schicht du kopieren willst.'}

              </Text>

            </View>

          )}



          <View style={{flexDirection: 'row', backgroundColor: theme.head, height: 35, alignItems: 'center'}}>

            <View style={{width: 55, alignItems: 'center'}}><Text style={styles.headLabel}>TAG</Text></View>

            <ScrollView horizontal ref={headerScrollRef} scrollEnabled={false} showsHorizontalScrollIndicator={false}>

              {personKeys.map(k => (

                <TouchableOpacity key={k} style={{width: 60, justifyContent: 'center', alignItems: 'center'}} onPress={() => { setSelectedPersonKey(k); setTempName(personNames[k]); setNameModalVisible(true); }}>

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

                      <TouchableOpacity 

                        disabled={!ft}

                        onPress={() => handleFeiertagClick(s.datum)}

                        style={[styles.sideCell, {borderBottomColor: theme.bor, backgroundColor: ft ? (isDarkMode ? '#3d1010' : '#ffebee') : 'transparent'}]}

                      >

                        <Text style={[styles.tagTxt, {color: (s.tag==='Sa'||s.tag==='So'||ft) ? '#e91e63' : theme.txt}]}>{s.tag}</Text>

                        <Text style={styles.dateTxt}>{s.datum.split('.')[0]}.</Text>

                      </TouchableOpacity>

                    </View>

                  );

                })}

              </View>

              

              <ScrollView 

                horizontal 

                cancelsTouchesInView={false}

                keyboardShouldPersistTaps="always"

                removeClippedSubviews={true}

                onScroll={e => headerScrollRef.current?.scrollTo({x: e.nativeEvent.contentOffset.x, animated: false})} 

                scrollEventThrottle={16}

              >

                <View>

                  {currentMonthShifts.map((s, i) => {

                    const isNewM = i === 0 || s.datum.split('.')[1] !== currentMonthShifts[i-1].datum.split('.')[1];

                    return (

                      <View key={s.id}>

                        {isNewM && <View style={[styles.monthLabel, {width: personKeys.length * 60}]} />}

                        <View style={{flexDirection: 'row'}}>

                          {personKeys.map(pk => {

                            const isSick = s[pk+'Col'] === 'krank';

                            const isUrl = s[pk] === 'URL' || (pk === 'p1' && urlaubNummerierung.mapping[s.id]);

                            

                            const cellBg = isSick 

                              ? '#b71c1c' 

                              : (isUrl ? '#00bcd4' : s[pk+'Col']);

                            

                            let cellLabel = isSick ? `✚ ${s[pk]}` : s[pk];

                            if (!isSick && pk === 'p1' && cellLabel === 'URL') {

                              cellLabel = urlaubNummerierung.mapping[s.id] || 'URL';

                            }



                            return (

                              <TouchableOpacity 

                                key={pk} 

                                delayPressIn={0}

                                activeOpacity={0.5}

                                style={[styles.cell, {backgroundColor: cellBg, borderBottomColor: theme.bor}]} 

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

            </View>

          </ScrollView>

        </View>

      ) : activeTab === 'Statistik' ? renderStatistik() : renderMeinPlan()}



      <View style={[styles.tabBar, {backgroundColor: theme.card, borderTopColor: theme.bor}]}>

        <TouchableOpacity style={styles.tab} onPress={() => setActiveTab('MeinPlan')}><Ionicons name="calendar" size={22} color={activeTab === 'MeinPlan' ? theme.acc : '#888'} /><Text style={{fontSize: 10, color: activeTab === 'MeinPlan' ? theme.acc : '#888', marginTop: 4}}>Mein Plan</Text></TouchableOpacity>

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

                          if (selectedCell.pk === 'p1' && s.l === 'URL') {

                            setModalVisible(false);

                            setPendingUrlaubCell({ rowId: selectedCell.rowId, label: 'URL', color: '#00bcd4' });

                            setUrlaubModalVisible(true);

                            return;

                          }

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

                        if (selectedCell.pk === 'p1') {

                          setModalVisible(false);

                          setPendingUrlaubCell({ rowId: selectedCell.rowId, label: 'URL', color: '#00bcd4' });

                          setUrlaubModalVisible(true);

                        } else {

                          setShifts(shifts.map(r => r.id === selectedCell.rowId ? {...r, [selectedCell.pk]: 'URL', [selectedCell.pk+'Col']: '#00bcd4'} : r));

                          if (copyModeActive) { setCopiedValue({ label: 'URL', color: '#00bcd4' }); }

                          setModalVisible(false);

                        }

                      }}

                    >

                      <Ionicons name="airplane-outline" size={12} color="white" />

                      <Text style={{color: 'white', fontSize: 9, fontWeight: 'bold', marginTop: 1, textAlign: 'center'}} numberOfLines={1}>URLAUB</Text>

                    </TouchableOpacity>

                  </View>

                  

                  <View style={styles.optContainer}>

                    <TouchableOpacity 

                      style={[styles.opt, {backgroundColor: '#b71c1c', borderRadius: 12, width: '100%', margin: 0, paddingVertical: 4, justifyContent: 'center', alignItems: 'center'}]} 

                      onPress={() => { 

                        setShifts(shifts.map(r => r.id === selectedCell.rowId ? {...r, [selectedCell.pk+'Col']: 'krank'} : r)); 

                        if (copyModeActive) { setCopiedValue({ label: 'KRANK', color: 'krank' }); }

                        setModalVisible(false); 

                      }}

                    >

                      <Ionicons name="medkit-outline" size={12} color="white" />

                      <Text style={{color: 'white', fontSize: 9, fontWeight: 'bold', marginTop: 1, textAlign: 'center'}} numberOfLines={1}>KRANK</Text>

                    </TouchableOpacity>

                  </View>



                  <View style={styles.optContainer}>

                    <TouchableOpacity 

                      style={[styles.opt, {backgroundColor: isDarkMode ? '#2c2c2c' : '#f0f0f0', borderRadius: 12, borderWidth: 1, borderColor: isDarkMode ? '#444' : '#ddd', width: '100%', margin: 0, paddingVertical: 4, justifyContent: 'center', alignItems: 'center'}]} 

                      onPress={() => { 

                        if (selectedCell.pk === 'p1' && urlaubGueltigkeit[selectedCell.rowId]) {

                          const updatedGueltigkeit = { ...urlaubGueltigkeit };

                          delete updatedGueltigkeit[selectedCell.rowId];

                          setUrlaubGueltigkeit(updatedGueltigkeit);

                        }

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



      <Modal visible={urlaubModalVisible} transparent animationType="fade">

        <View style={styles.modalBack}>

          <View style={[styles.modalBox, {backgroundColor: theme.card}]}>

            <Text style={{color: theme.txt, fontWeight: 'bold', marginBottom: 10, textAlign: 'center'}}>Urlaubsjahr festlegen</Text>

            <Text style={{color: theme.sub, fontSize: 12, marginBottom: 20, textAlign: 'center'}}>Für welches Urlaubsjahr soll dieser Tag angerechnet werden?</Text>

            

            <TouchableOpacity style={[styles.saveBtn, {backgroundColor: theme.acc, marginBottom: 10}]} onPress={() => handleSelectUrlaubGueltigkeit('aktuell')}>

              <Text style={{color: 'white', fontWeight: 'bold'}}>Aktuelles Jahr ({2026})</Text>

            </TouchableOpacity>

            

            <TouchableOpacity style={[styles.saveBtn, {backgroundColor: '#4caf50', marginBottom: 15}]} onPress={() => handleSelectUrlaubGueltigkeit('folgejahr')}>

              <Text style={{color: 'white', fontWeight: 'bold'}}>Folgejahr ({2027})</Text>

            </TouchableOpacity>



            <TouchableOpacity style={[styles.saveBtn, {backgroundColor: '#9e9e9e'}]} onPress={() => { setUrlaubModalVisible(false); setPendingUrlaubCell(null); }}>

              <Text style={{color: 'white', fontWeight: 'bold'}}>Abbrechen</Text>

            </TouchableOpacity>

          </View>

        </View>

      </Modal>



      <Modal visible={nameModalVisible} transparent animationType="slide">

        <View style={styles.modalBack}><View style={[styles.modalBox, {backgroundColor: theme.card}]}>

          <TextInput style={[styles.input, {color: theme.txt, borderBottomColor: theme.acc}]} value={tempName} onChangeText={setTempName} autoFocus={true} />

          <TouchableOpacity style={[styles.saveBtn, {backgroundColor: theme.acc}]} onPress={() => { setPersonNames({...personNames, [selectedPersonKey]: tempName}); setNameModalVisible(false); }}><Text style={{color: 'white', fontWeight: 'bold'}}>Speichern</Text></TouchableOpacity>

        </View></View>

      </Modal>



      <Modal visible={myPlanModalVisible} transparent animationType="fade">

        <View style={styles.modalBack}>

          <View style={[styles.modalBox, { backgroundColor: theme.card, width: '90%' }]}>

            <Text style={{ color: theme.txt, fontWeight: 'bold', fontSize: 14, marginBottom: 5, textAlign: 'center' }}>Tag manuell anpassen</Text>

            <Text style={{ color: theme.sub, fontSize: 11, marginBottom: 15, textAlign: 'center' }}>{myPlanSelectedDay?.tag}, {myPlanSelectedDay?.datum}</Text>

            

            <Text style={styles.timeInputSubLabel}>Schicht-Kürzel</Text>

            <TextInput 

              style={[styles.input, { color: theme.txt, borderBottomColor: theme.acc, fontSize: 16, marginBottom: 10, paddingVertical: 4 }]} 

              value={myPlanEditLabel} 

              onChangeText={setMyPlanEditLabel} 

              placeholder="z.B. SV oder FREI" 

              placeholderTextColor="#666"

            />



            <View style={[styles.timeInputRow, { marginTop: 5 }]}>

              <View style={styles.timeInputWrapper}>

                <Text style={styles.timeInputSubLabel}>Startzeit</Text>

                <TextInput 

                  style={[styles.timeTextInput, { color: theme.txt, borderColor: theme.bor }]} 

                  value={myPlanEditStart} 

                  onChangeText={(t) => formatTimeHHMM(t, setMyPlanEditStart, myPlanEndRef)} 

                  placeholder="06:00" 

                  placeholderTextColor="#666"

                  keyboardType="numeric"

                  maxLength={5}

                />

              </View>

              <View style={styles.timeInputWrapper}>

                <Text style={styles.timeInputSubLabel}>Endzeit</Text>

                <TextInput 

                  ref={myPlanEndRef}

                  style={[styles.timeTextInput, { color: theme.txt, borderColor: theme.bor }]} 

                  value={myPlanEditEnd} 

                  onChangeText={(t) => formatTimeHHMM(t, setMyPlanEditEnd, myPlanPauseRef)} 

                  placeholder="14:00" 

                  placeholderTextColor="#666"

                  keyboardType="numeric"

                  maxLength={5}

                />

              </View>

              <View style={styles.timeInputWrapper}>

                <Text style={styles.timeInputSubLabel}>Pause (Min)</Text>

                <TextInput 

                  ref={myPlanPauseRef}

                  style={[styles.timeTextInput, { color: theme.txt, borderColor: theme.bor }]} 

                  value={myPlanEditPause} 

                  onChangeText={setMyPlanEditPause} 

                  placeholder="30" 

                  keyboardType="numeric" 

                  placeholderTextColor="#666" 

                />

              </View>

            </View>



            <View style={styles.modalButtonRowHorizontal}>

              <TouchableOpacity style={[styles.saveBtn, { backgroundColor: '#e91e63', flex: 0.3, justifyContent: 'center', alignItems: 'center' }]} onPress={resetMyPlanDayChanges}>

                <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 11, textAlign: 'center' }}>Löschen</Text>

              </TouchableOpacity>

              <TouchableOpacity style={[styles.saveBtn, { backgroundColor: '#9e9e9e', flex: 0.3, justifyContent: 'center', alignItems: 'center' }]} onPress={() => setMyPlanModalVisible(false)}>

                <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 11, textAlign: 'center' }}>Abbrechen</Text>

              </TouchableOpacity>

              <TouchableOpacity style={[styles.saveBtn, { backgroundColor: theme.acc, flex: 0.35, justifyContent: 'center', alignItems: 'center' }]} onPress={saveMyPlanDayChanges}>

                <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 11, textAlign: 'center' }}>Speichern</Text>

              </TouchableOpacity>

            </View>

          </View>

        </View>

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

  statHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, paddingLeft: 5, marginTop: 15 },

  calendarHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, paddingLeft: 5, marginTop: 15 },

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

  backupInput: { height: 80, borderWidth: 1, borderRadius: 12, padding: 10, fontSize: 10, textAlignVertical: 'top' },

  backupBtn: { padding: 12, borderRadius: 10, flex: 0.48, alignItems: 'center' },

  btnTxt: { color: 'white', fontWeight: 'bold', fontSize: 11 },

  customShiftContainer: { flexDirection: 'row', borderWidth: 1, borderRadius: 10, overflow: 'hidden', marginBottom: 10 },

  customInput: { width: '70%', height: 40, paddingHorizontal: 12, fontSize: 13, fontWeight: 'bold' },

  customAddBtn: { width: '30%', justifyContent: 'center', alignItems: 'center' },

  paletteRow: { flexDirection: 'row', justifyContent: 'flex-start', flexWrap: 'wrap', marginBottom: 15, paddingHorizontal: 5, gap: 8 },

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

  devDivider: { height: 0.5, width: '100%', marginVertical: 10 },

  copyModeBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, marginLeft: 8 },

  copyModeBtnTxt: { fontSize: 11, fontWeight: 'bold' },

  copyInfoBar: { paddingVertical: 6, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },

  copyInfoBarTxt: { color: 'white', fontSize: 11, fontWeight: '600', textAlign: 'center' },

  myPlanRow: { flexDirection: 'row', paddingVertical: 10, borderBottomWidth: 0.5, alignItems: 'center' },

  myPlanRowHeaderTxt: { fontSize: 9, fontWeight: 'bold' },

  modernStatsDashboardGrid: { paddingHorizontal: 10, paddingTop: 10, paddingBottom: 8 },

  modernDashboardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'stretch' },

  modernStatTileVertical: { minWidth: 78, flex: 1, minHeight: 115, borderRadius: 12, padding: 6, borderWidth: 1, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, marginHorizontal: 3, justifyContent: 'space-between' },

  modernTileHeader: { flexDirection: 'column', alignItems: 'center', marginBottom: 4 },

  modernIconBadge: { width: 22, height: 22, borderRadius: 6, justifyContent: 'center', alignItems: 'center', marginBottom: 3 },

  modernTileLabel: { fontSize: 8.5, fontWeight: '700', color: '#888', textAlign: 'center', letterSpacing: 0.1 },

  modernMainRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', marginVertical: 2 },

  modernValueHighlight: { fontSize: 15, fontWeight: '800', letterSpacing: -0.5 },

  modernUnit: { fontSize: 8, fontWeight: '600', marginLeft: 2 },

  modernSollRowElement: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' },

  modernSollInlineLabel: { fontSize: 8, fontWeight: '600' },

  modernSollInput: { width: 34, fontSize: 9, fontWeight: '700', paddingHorizontal: 2, borderRadius: 4, textAlign: 'center', height: 18, paddingVertical: 0 },

  modernBadgeDiff: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', paddingVertical: 1.5, paddingHorizontal: 2, borderRadius: 5, justifyContent: 'center' },

  modernBadgeDiffText: { fontSize: 8, fontWeight: '700' },

  modernBadgeSpacePlaceholder: { height: 14, width: '100%' }

});

