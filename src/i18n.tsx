import React, { useEffect, useState } from 'react';

export type AppLanguage = 'en' | 'hi' | 'hinglish';

const translations: Record<AppLanguage, Record<string, string>> = {
  en: {},
  hi: {
    'Home': 'होम', 'Book': 'बुक करें', 'Book a driver': 'ड्राइवर बुक करें', 'Your trips': 'आपकी यात्राएँ',
    'Trips': 'यात्राएँ', 'Wallet': 'वॉलेट', 'Help': 'सहायता', 'Rides': 'राइड्स', 'History': 'इतिहास',
    'Earnings': 'कमाई', 'Profile': 'प्रोफ़ाइल', 'Overview': 'अवलोकन', 'Bookings': 'बुकिंग',
    'Drivers': 'ड्राइवर', 'Disputes': 'शिकायतें', 'Sign In': 'साइन इन', 'Sign Up': 'साइन अप',
    'Sign In to Your Account': 'अपने खाते में साइन इन करें', 'Create Account': 'खाता बनाएँ',
    'Join as Driver Partner': 'ड्राइवर पार्टनर के रूप में जुड़ें', 'Create Customer Account': 'ग्राहक खाता बनाएँ',
    'Access your rides and bookings': 'अपनी राइड और बुकिंग देखें',
    'Book verified drivers for your personal vehicle': 'अपनी कार के लिए सत्यापित ड्राइवर बुक करें',
    'Full Name': 'पूरा नाम', 'Phone Number': 'फ़ोन नंबर', 'City / Service Area': 'शहर / सेवा क्षेत्र',
    'Email Address': 'ईमेल पता', 'Password': 'पासवर्ड', 'Customer': 'ग्राहक', 'Driver Partner': 'ड्राइवर पार्टनर',
    'Vehicle Class You Drive': 'आप कौन-सी गाड़ी चलाते हैं', 'Driving Licence Number': 'ड्राइविंग लाइसेंस नंबर',
    'Save Changes': 'बदलाव सेव करें', 'Cancel': 'रद्द करें', 'Phone': 'फ़ोन', 'Vehicle class': 'वाहन श्रेणी',
    'City': 'शहर', 'Total trips': 'कुल यात्राएँ', 'Rating': 'रेटिंग', 'Upcoming': 'आने वाली',
    'Complete Trip Payment': 'यात्रा का भुगतान पूरा करें', 'Total Fare Amount': 'कुल किराया',
    'Pay': 'भुगतान करें', 'Securely': 'सुरक्षित रूप से', 'LIVE RIDE TRACKING': 'लाइव राइड ट्रैकिंग',
    'Your Driver is on the Move': 'आपका ड्राइवर रास्ते में है', 'Estimated Arrival': 'अनुमानित आगमन',
    'Start OTP': 'शुरुआती OTP', 'RIDE FEEDBACK': 'राइड पर प्रतिक्रिया', 'Rate Your Driver Partner': 'अपने ड्राइवर को रेट करें',
    'Submit Rating': 'रेटिंग सबमिट करें', 'File a Dispute': 'शिकायत दर्ज करें', 'Report a Problem': 'समस्या की रिपोर्ट करें',
    'Our team reviews and responds within 24 hours.': 'हमारी टीम 24 घंटे के भीतर समीक्षा करके जवाब देगी।',
    'Related Booking (optional)': 'संबंधित बुकिंग (वैकल्पिक)', 'Subject': 'विषय', 'Description': 'विवरण',
    'Submit Dispute': 'शिकायत सबमिट करें', 'Select a subject…': 'विषय चुनें…', 'Other': 'अन्य',
    'Fare dispute': 'किराये से संबंधित शिकायत', 'Driver behaviour': 'ड्राइवर का व्यवहार',
    'Trip not completed': 'यात्रा पूरी नहीं हुई', 'OTP issue': 'OTP की समस्या', 'Payment issue': 'भुगतान की समस्या',
    'No specific booking': 'कोई विशेष बुकिंग नहीं', 'Delhi': 'दिल्ली', 'Gurugram': 'गुरुग्राम',
    'Hourly': 'घंटे के हिसाब से', 'Sedan': 'सेडान', 'Hatchback': 'हैचबैक', 'SUV': 'एसयूवी', 'Luxury': 'लग्ज़री',
    'Welcome back': 'वापसी पर स्वागत है', 'Something went wrong.': 'कुछ गलत हो गया।',
    'Thank you for rating your driver!': 'अपने ड्राइवर को रेट करने के लिए धन्यवाद!',
    'Language': 'भाषा', 'English': 'अंग्रेज़ी', 'Hindi': 'हिंदी', 'Hinglish': 'हिंग्लिश'
  },
  hinglish: {
    'Home': 'Home', 'Book': 'Book karo', 'Book a driver': 'Driver book karo', 'Your trips': 'Aapki trips',
    'Trips': 'Trips', 'Wallet': 'Wallet', 'Help': 'Help', 'Rides': 'Rides', 'History': 'History',
    'Earnings': 'Kamai', 'Profile': 'Profile', 'Overview': 'Overview', 'Bookings': 'Bookings',
    'Drivers': 'Drivers', 'Disputes': 'Complaints', 'Sign In': 'Sign In karo', 'Sign Up': 'Sign Up karo',
    'Sign In to Your Account': 'Apne account mein sign in karo', 'Create Account': 'Account banao',
    'Join as Driver Partner': 'Driver Partner bano', 'Create Customer Account': 'Customer account banao',
    'Access your rides and bookings': 'Apni rides aur bookings dekho',
    'Book verified drivers for your personal vehicle': 'Apni car ke liye verified driver book karo',
    'Full Name': 'Poora naam', 'Phone Number': 'Phone number', 'City / Service Area': 'City / service area',
    'Email Address': 'Email address', 'Password': 'Password', 'Customer': 'Customer', 'Driver Partner': 'Driver Partner',
    'Vehicle Class You Drive': 'Aap kaunsi gaadi chalate ho', 'Driving Licence Number': 'Driving licence number',
    'Save Changes': 'Changes save karo', 'Cancel': 'Cancel karo', 'Phone': 'Phone', 'Vehicle class': 'Vehicle type',
    'City': 'City', 'Total trips': 'Total trips', 'Rating': 'Rating', 'Upcoming': 'Aane wali',
    'Complete Trip Payment': 'Trip ka payment complete karo', 'Total Fare Amount': 'Total fare',
    'LIVE RIDE TRACKING': 'Live ride tracking', 'Your Driver is on the Move': 'Aapka driver raste mein hai',
    'Estimated Arrival': 'Pahunchne ka estimated time', 'Start OTP': 'Start OTP',
    'RIDE FEEDBACK': 'Ride feedback', 'Rate Your Driver Partner': 'Apne driver ko rate karo',
    'Submit Rating': 'Rating submit karo', 'File a Dispute': 'Complaint darj karo', 'Report a Problem': 'Problem report karo',
    'Our team reviews and responds within 24 hours.': 'Hamari team 24 hours ke andar review karke reply karegi.',
    'Related Booking (optional)': 'Related booking (optional)', 'Subject': 'Subject', 'Description': 'Description',
    'Submit Dispute': 'Complaint submit karo', 'Select a subject…': 'Subject select karo…', 'Other': 'Other',
    'Fare dispute': 'Fare ki complaint', 'Driver behaviour': 'Driver ka behaviour',
    'Trip not completed': 'Trip complete nahi hui', 'OTP issue': 'OTP issue', 'Payment issue': 'Payment issue',
    'No specific booking': 'Koi specific booking nahi', 'Delhi': 'Delhi', 'Gurugram': 'Gurugram',
    'Hourly': 'Hourly', 'Sedan': 'Sedan', 'Hatchback': 'Hatchback', 'SUV': 'SUV', 'Luxury': 'Luxury',
    'Language': 'Language', 'English': 'English', 'Hindi': 'Hindi', 'Hinglish': 'Hinglish'
  }
};

const normalize = (value: string) => value.replace(/\s+/g, ' ').trim();
const sourceText = (value: string) => {
  const key = normalize(value);
  for (const language of ['hi', 'hinglish'] as AppLanguage[]) {
    const entry = Object.entries(translations[language]).find(([, translated]) => normalize(translated) === key);
    if (entry) return entry[0];
  }
  return key;
};
const translate = (value: string, language: AppLanguage) => {
  const key = sourceText(value);
  return translations[language][key] ?? key;
};

function applyTranslations(root: HTMLElement, language: AppLanguage) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  nodes.forEach(node => {
    const original = node.textContent ?? '';
    const leading = original.match(/^\s*/)?.[0] ?? '';
    const trailing = original.match(/\s*$/)?.[0] ?? '';
    const clean = normalize(original);
    if (!clean) return;
    const source = sourceText(clean);
    const translated = translations[language][source] ?? source;
    if (translated !== clean) node.textContent = leading + translated + trailing;
  });

  const attributes = ['placeholder', 'title', 'aria-label'];
  root.querySelectorAll<HTMLElement>('*').forEach(element => {
    attributes.forEach(attribute => {
      const value = element.getAttribute(attribute);
      if (value) {
        const source = sourceText(value);
        const translated = translations[language][source] ?? source;
        if (translated !== value) element.setAttribute(attribute, translated);
      }
    });
  });
}

export function useAppTranslations(language: AppLanguage) {
  useEffect(() => {
    const root = document.getElementById('root');
    if (!root) return;
    let scheduled = false;
    const run = () => {
      scheduled = false;
      applyTranslations(root, language);
    };
    run();
    const observer = new MutationObserver(() => {
      if (scheduled) return;
      scheduled = true;
      queueMicrotask(run);
    });
    observer.observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['placeholder', 'title', 'aria-label'] });
    return () => observer.disconnect();
  }, [language]);
}

export function LanguageSwitcher() {
  const [language, setLanguage] = useState<AppLanguage>(() => {
    const saved = localStorage.getItem('vs_language');
    return saved === 'hi' || saved === 'hinglish' ? saved : 'en';
  });
  useAppTranslations(language);

  const changeLanguage = (next: AppLanguage) => {
    setLanguage(next);
    localStorage.setItem('vs_language', next);
    document.documentElement.lang = next === 'hi' ? 'hi-IN' : 'en-IN';
    window.dispatchEvent(new CustomEvent('vs-language-change', { detail: next }));
  };

  return (
    <div className="vs-language-switcher" role="group" aria-label="Language">
      <span className="vs-language-icon" aria-hidden="true">文</span>
      <select value={language} onChange={event => changeLanguage(event.target.value as AppLanguage)} aria-label="Choose language">
        <option value="en">English</option>
        <option value="hi">हिन्दी</option>
        <option value="hinglish">Hinglish</option>
      </select>
    </div>
  );
}
