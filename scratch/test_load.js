const fs = require('fs');

// Mock a browser environment
global.window = {
  scrollTo: (x, y) => { console.log('window.scrollTo called with:', x, y); },
  supabase: null
};
global.document = {
  querySelectorAll: (selector) => {
    console.log('document.querySelectorAll called with:', selector);
    return [];
  },
  getElementById: (id) => {
    // console.log('document.getElementById called with:', id);
    if (id === 'c-empresa') return { value: 'CTAG CONSTRUÇÕES SERVIÇOS E IMÓ', focus: () => {} };
    if (id === 'c-contato') return { value: 'Lucas', focus: () => {} };
    if (id === 'c-cargo') return { value: 'Diretor', focus: () => {} };
    if (id === 'c-email') return { value: 'kefipromo@gmail.com', focus: () => {}, checkValidity: () => true };
    if (id === 'c-telefone') return { value: '(85) 9986-0066', focus: () => {} };
    if (id === 'c-consultor') return { value: 'Façanha', focus: () => {} };
    if (id === 'c-data') return { value: '26/09/2026', focus: () => {} };
    if (id === 'progress-fill') return { style: {} };
    if (id === 'nav-step') return { textContent: '' };
    if (id === 'b0-card') return { innerHTML: '' };
    if (id === 'screen-b0') return { classList: { add: (c) => console.log('Add class:', c), remove: () => {} } };
    return {
      value: '',
      style: {},
      classList: {
        add: () => {},
        remove: () => {}
      }
    };
  }
};
global.localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {}
};
global.navigator = {};
global.location = {};

// Load script.js
try {
  const code = fs.readFileSync('script.js', 'utf8');
  eval(code);
  console.log('Successfully evaluated script.js!');
  
  // Try calling startAssessment
  if (typeof startAssessment === 'function') {
    console.log('Calling startAssessment()...');
    startAssessment();
    console.log('Called startAssessment() successfully!');
    console.log('State S is now:', JSON.stringify(S, null, 2));
  } else {
    console.error('startAssessment is not a function!');
  }
} catch (e) {
  console.error('Error occurred:', e);
}
