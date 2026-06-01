const fs = require('fs');

// Mock browser globals
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

// Load and evaluate deployed script.js
try {
  const content = fs.readFileSync('C:\\Users\\Lucas Fernandes\\.gemini\\antigravity-ide\\brain\\3ac68998-bb90-485b-9289-2abb74b7dfb7\\.system_generated\\steps\\175\\content.md', 'utf8');
  // Strip header up to '---'
  const index = content.indexOf('---');
  if (index === -1) throw new Error('Could not find separator ---');
  const code = content.substring(index + 3);
  
  eval(code);
  console.log('Successfully evaluated deployed script.js!');
  
  if (typeof startAssessment === 'function') {
    startAssessment();
    console.log('Called startAssessment() successfully!');
  } else {
    console.error('startAssessment is not a function!');
  }
} catch (e) {
  console.error('Error occurred:', e);
}
