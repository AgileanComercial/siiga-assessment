const fs = require('fs');

// Mock a browser environment
global.window = {
  scrollTo: () => {},
  supabase: null
};
global.document = {
  querySelectorAll: () => [],
  getElementById: (id) => {
    // console.log('document.getElementById called with:', id);
    if (id === 'c-empresa') return { value: 'Test Empresa', focus: () => {} };
    if (id === 'c-contato') return { value: 'Test Contato', focus: () => {} };
    if (id === 'c-cargo') return { value: 'Test Cargo', focus: () => {} };
    if (id === 'c-email') return { value: 'test@email.com', focus: () => {}, checkValidity: () => true };
    if (id === 'c-telefone') return { value: '(85) 99999-9999', focus: () => {} };
    if (id === 'c-consultor') return { value: 'Test Consultor', focus: () => {} };
    if (id === 'c-data') return { value: '01/06/2026', focus: () => {} };
    if (id === 'progress-fill') return { style: {} };
    if (id === 'nav-step') return { textContent: '' };
    if (id === 'b0-card') return { innerHTML: '' };
    if (id === 'screen-b0') return { classList: { add: () => {}, remove: () => {} } };
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
  } else {
    console.error('startAssessment is not a function!');
  }
} catch (e) {
  console.error('Error occurred:', e);
}
