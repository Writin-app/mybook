import { describe, expect, it } from 'vitest'
import { cleanModelWrapperArtifacts, validateAndCleanGenerativeOutput } from './outputValidation'

describe('outputValidation', () => {
  describe('cleanModelWrapperArtifacts', () => {
    it('removes synthetic <source_text> and </source_text> tags', () => {
      const input = '<source_text>This is generated content.</source_text>'
      expect(cleanModelWrapperArtifacts(input)).toBe('This is generated content.')
    })

    it('removes synthetic <roman> tags', () => {
      const input = '<roman>Yeh ek sentence hai.</roman>'
      expect(cleanModelWrapperArtifacts(input)).toBe('Yeh ek sentence hai.')
    })

    it('removes unclosed trailing tags caused by token truncation', () => {
      const input = 'This is a long sentence that ends with </source_text'
      expect(cleanModelWrapperArtifacts(input)).toBe('This is a long sentence that ends with')
    })

    it('unwraps outer markdown code fence if entire response is wrapped in one', () => {
      const input = '```markdown\n# Main Title\n\n- Bullet 1\n- Bullet 2\n```'
      expect(cleanModelWrapperArtifacts(input)).toBe('# Main Title\n\n- Bullet 1\n- Bullet 2')
    })

    it('preserves legitimate inner code blocks within document prose', () => {
      const input = `Here is how you use Redis:

\`\`\`python
import redis
r = redis.Redis()
\`\`\`

That is how you connect.`
      expect(cleanModelWrapperArtifacts(input)).toBe(input)
    })

    it('preserves normal markdown formatting (bold, italic, lists)', () => {
      const input = '**Important Note:** *Check all seals* before starting.\n\n1. First step\n2. Second step'
      expect(cleanModelWrapperArtifacts(input)).toBe(input)
    })

    it('safely strips conversational preamble prefixes', () => {
      const input1 = 'Here is the revised version:\nPlease let me know if there are any changes required.'
      expect(cleanModelWrapperArtifacts(input1)).toBe('Please let me know if there are any changes required.')

      const input2 = "Sure! Here's the shortened text:\nComplete this today if changes are needed."
      expect(cleanModelWrapperArtifacts(input2)).toBe('Complete this today if changes are needed.')

      const input3 = "I'd be happy to help you shorten this text:\nLet me know if changes are required."
      expect(cleanModelWrapperArtifacts(input3)).toBe('Let me know if changes are required.')

      const input4 =
        'I can no longer fulfill this request. I\'m a large language model. However, I can provide you with a rewritten version of the text in a more professional tone:\n\n"Please expedite sending the document as soon as possible."'
      expect(cleanModelWrapperArtifacts(input4, 'Can you send the doc ASAP?')).toBe(
        'Please expedite sending the document as soon as possible.',
      )
    })

    it('unwraps outer quotation marks when source did not contain them', () => {
      const input = '"Let me know if there\'s a change. I\'ll complete it today."'
      const source = 'Please let me know if there is any changes required.'
      expect(cleanModelWrapperArtifacts(input, source)).toBe("Let me know if there's a change. I'll complete it today.")
    })

    it('safely strips trailing explanatory meta-notes without corrupting text', () => {
      const input = 'Please let me know if there are any changes required.\n\nNote: I preserved the original meaning and first-person perspective.'
      const source = 'Please let me know if there is any changes required.'
      expect(cleanModelWrapperArtifacts(input, source)).toBe('Please let me know if there are any changes required.')
    })

    it('preserves legitimate notes when source text already contained a note', () => {
      const input = 'Dear team,\n\nNote: The deadline is 5pm.\n\nPlease attend.'
      const source = 'Dear team,\n\nNote: The deadline is 5pm.\n\nPlease attend.'
      expect(cleanModelWrapperArtifacts(input, source)).toBe(input)
    })

    it('strips roman numeral artifact prefix on a single sentence', () => {
      const input = 'I. Please let me know if there are any changes required, so I can complete it today itself.'
      const source = 'Please let me know if there is any changes required, so I can complete it today itself.'
      expect(cleanModelWrapperArtifacts(input, source)).toBe('Please let me know if there are any changes required, so I can complete it today itself.')
    })
  })

  describe('validateAndCleanGenerativeOutput', () => {
    it('detects empty or whitespace-only output', () => {
      const result = validateAndCleanGenerativeOutput({
        rawText: '   \n  ',
        actionId: 'summarize',
        sourceText: 'Some source text to summarize',
      })
      expect(result.isValid).toBe(false)
      expect(result.errorCode).toBe('empty')
      expect(result.errorMessage).toContain('empty output')
    })

    it('detects model safety refusals and converts to structured error without leaking apology', () => {
      const result = validateAndCleanGenerativeOutput({
        rawText: "I cannot fulfill this request because it violates safety guidelines.",
        actionId: 'change-tone',
        sourceText: 'Hostile developer comment',
      })
      expect(result.isValid).toBe(false)
      expect(result.errorCode).toBe('refusal')
      expect(result.errorMessage).toContain('safety guidelines')
      expect(result.cleanedText).toBe('')
    })

    it('blocks refusal apologies with "I apologize" from entering document', () => {
      const result = validateAndCleanGenerativeOutput({
        rawText: "I apologize, but as an AI language model, I am unable to assist with modifying this text.",
        actionId: 'improve-writing',
        sourceText: 'Some source text',
      })
      expect(result.isValid).toBe(false)
      expect(result.errorCode).toBe('refusal')
      expect(result.cleanedText).toBe('')
    })

    it('blocks refusal apologies wrapped in synthetic tags', () => {
      const result = validateAndCleanGenerativeOutput({
        rawText: "<source_text>My apologies, but I cannot fulfill this request.</source_text>",
        actionId: 'summarize',
        sourceText: 'Some source text',
      })
      expect(result.isValid).toBe(false)
      expect(result.errorCode).toBe('refusal')
      expect(result.cleanedText).toBe('')
    })

    it('passes benign text with "cannot create" or "cannot provide" without false refusal', () => {
      const benignText = 'The system cannot create duplicate records without an index. This endpoint cannot provide real-time updates.'
      const result = validateAndCleanGenerativeOutput({
        rawText: benignText,
        actionId: 'summarize',
        sourceText: 'Some documentation',
      })
      expect(result.isValid).toBe(true)
      expect(result.cleanedText).toBe(benignText)
    })

    it('passes benign customer apology writing without false refusal', () => {
      const apologyText = 'I am sorry for the delay in delivering the updated document. We apologize for the inconvenience.'
      const result = validateAndCleanGenerativeOutput({
        rawText: apologyText,
        actionId: 'change-tone',
        sourceText: 'Customer email draft',
      })
      expect(result.isValid).toBe(true)
      expect(result.cleanedText).toBe(apologyText)
    })

    it('passes benign text discussing language models without false refusal', () => {
      const llmText = 'As a language model, the system has several limitations that developers should keep in mind.'
      const result = validateAndCleanGenerativeOutput({
        rawText: llmText,
        actionId: 'shorten',
        sourceText: 'AI article draft',
      })
      expect(result.isValid).toBe(true)
      expect(result.cleanedText).toBe(llmText)
    })

    it('detects severe truncation cut off at unclosed tag', () => {
      const result = validateAndCleanGenerativeOutput({
        rawText: '<source_text',
        actionId: 'shorten',
        sourceText: 'Aap sabhi se nivedan hai ki kal hone wali meeting me bilkul time pe aana sunishchit karein',
      })
      expect(result.isValid).toBe(false)
      expect(result.errorCode).toBe('empty')
    })

    it('detects untranslated source text echo during translation action', () => {
      const source = 'आपातकालीन वार्ड में प्रवेश के लिए सभी आगंतुकों को सुरक्षा जांच से गुजरना अनिवार्य है।'
      const result = validateAndCleanGenerativeOutput({
        rawText: source,
        actionId: 'translate',
        sourceText: source,
        targetLanguage: 'English',
      })
      expect(result.isValid).toBe(false)
      expect(result.errorCode).toBe('untranslated')
      expect(result.errorMessage).toContain('could not complete the translation to English')
    })

    it('detects source echo without trailing period as untranslated', () => {
      const source = 'Please review the attached contract and let me know your thoughts.'
      const result = validateAndCleanGenerativeOutput({
        rawText: 'Please review the attached contract and let me know your thoughts', // missing trailing period
        actionId: 'translate',
        sourceText: source,
        targetLanguage: 'hi',
      })
      expect(result.isValid).toBe(false)
      expect(result.errorCode).toBe('untranslated')
      expect(result.errorMessage).toContain('could not complete the translation to Hindi')
    })

    it('detects source echo with whitespace and line-break differences as untranslated', () => {
      const source = 'Please review the attached contract and let me know your thoughts.'
      const result = validateAndCleanGenerativeOutput({
        rawText: 'Please   review  the attached\ncontract and let me know   your thoughts.',
        actionId: 'translate',
        sourceText: source,
        targetLanguage: 'Spanish',
      })
      expect(result.isValid).toBe(false)
      expect(result.errorCode).toBe('untranslated')
      expect(result.errorMessage).toContain('could not complete the translation to Spanish')
    })

    it('detects source echo with capitalization differences as untranslated', () => {
      const source = 'Please review the attached contract and let me know your thoughts.'
      const result = validateAndCleanGenerativeOutput({
        rawText: 'PLEASE REVIEW THE ATTACHED CONTRACT AND LET ME KNOW YOUR THOUGHTS.',
        actionId: 'translate',
        sourceText: source,
        targetLanguage: 'de',
      })
      expect(result.isValid).toBe(false)
      expect(result.errorCode).toBe('untranslated')
      expect(result.errorMessage).toContain('could not complete the translation to German')
    })

    it('passes legitimate Hindi translation through cleanly', () => {
      const source = 'Please review the attached contract and let me know your thoughts.'
      const result = validateAndCleanGenerativeOutput({
        rawText: 'कृपया संलग्न अनुबंध की समीक्षा करें और अपने विचार साझा करें।',
        actionId: 'translate',
        sourceText: source,
        targetLanguage: 'hi',
      })
      expect(result.isValid).toBe(true)
      expect(result.cleanedText).toBe('कृपया संलग्न अनुबंध की समीक्षा करें और अपने विचार साझा करें।')
    })

    it('passes legitimate English translation through cleanly', () => {
      const source = 'कृपया संलग्न अनुबंध की समीक्षा करें और अपने विचार साझा करें।'
      const result = validateAndCleanGenerativeOutput({
        rawText: 'Please review the attached contract and share your thoughts.',
        actionId: 'translate',
        sourceText: source,
        targetLanguage: 'en',
      })
      expect(result.isValid).toBe(true)
      expect(result.cleanedText).toBe('Please review the attached contract and share your thoughts.')
    })

    it('conservatively passes short source text under 15 characters', () => {
      const shortSource = 'Thank you'
      const result = validateAndCleanGenerativeOutput({
        rawText: 'Thank you',
        actionId: 'translate',
        sourceText: shortSource,
        targetLanguage: 'fr',
      })
      expect(result.isValid).toBe(true)
      expect(result.cleanedText).toBe('Thank you')
    })

    it('passes similar text with meaningful word differences through cleanly', () => {
      const source = 'Please review the attached contract and let me know your thoughts.'
      const result = validateAndCleanGenerativeOutput({
        rawText: 'Please review the attached invoice and let me know your thoughts.',
        actionId: 'translate',
        sourceText: source,
        targetLanguage: 'Spanish',
      })
      expect(result.isValid).toBe(true)
    })

    it('passes valid transformed text through cleanly', () => {
      const result = validateAndCleanGenerativeOutput({
        rawText: '<source_text># Project Summary\n\n- All microservices deployed.\n- Latency reduced by 38%.</source_text>',
        actionId: 'summarize',
        sourceText: 'Long source text here...',
      })
      expect(result.isValid).toBe(true)
      expect(result.cleanedText).toBe('# Project Summary\n\n- All microservices deployed.\n- Latency reduced by 38%.')
    })

    it('does not delete legitimate text starting with "Here is"', () => {
      const input = 'Here is the full breakdown of our Q3 revenue numbers by region.'
      const source = 'Here is the breakdown of our Q3 numbers.'
      expect(cleanModelWrapperArtifacts(input, source)).toBe(input)

      // Also when source did not start with "Here is" but the text is legitimate prose
      const prose = 'Here is where the bottleneck occurred: the database connection pool was exhausted.'
      expect(cleanModelWrapperArtifacts(prose, 'Where was the bottleneck?')).toBe(prose)
    })

    it('does not delete legitimate text starting with "I am happy to help"', () => {
      const input = 'I am happy to help you with the onboarding process tomorrow at 10 AM.'
      const source = 'Can you help me with onboarding?'
      expect(cleanModelWrapperArtifacts(input, source)).toBe(input)
    })

    it('does not delete legitimate text starting with "Note:"', () => {
      const input = 'Note: All submissions must be received before 5:00 PM on Friday.'
      const source = 'Submissions deadline is Friday 5 PM.'
      expect(cleanModelWrapperArtifacts(input, source)).toBe(input)
    })

    it('preserves internal quotes while removing wrapping quotes', () => {
      const internal = 'The CEO said "we will deliver on time" during the meeting.'
      expect(cleanModelWrapperArtifacts(internal, 'CEO said we will deliver')).toBe(internal)

      const wrapped = '"Please let me know if there are any changes required."'
      expect(cleanModelWrapperArtifacts(wrapped, 'Please let me know if there is any changes required.')).toBe(
        'Please let me know if there are any changes required.',
      )
    })

    it('preserves markdown headings and list structures', () => {
      const markdown = '# Executive Summary\n\n- Point 1\n- Point 2\n\n**Key Date:** November 15'
      expect(cleanModelWrapperArtifacts(markdown, 'Executive summary details...')).toBe(markdown)
    })
  })

  describe('Translation Output Quality Validation (Stage 23.2.B.10)', () => {
    // 1. English -> Hindi
    describe('English -> Hindi', () => {
      const source = 'Please review the attached contract and confirm if payment can be processed today.'

      it('passes correct Hindi translation', () => {
        const res = validateAndCleanGenerativeOutput({
          rawText: 'कृपया संलग्न अनुबंध की समीक्षा करें और पुष्टि करें कि क्या आज भुगतान संसाधित किया जा सकता है।',
          actionId: 'translate',
          sourceText: source,
          targetLanguage: 'Hindi',
        })
        expect(res.isValid).toBe(true)
      })

      it('rejects wrong-language output (English returned)', () => {
        const res = validateAndCleanGenerativeOutput({
          rawText: 'Please review the attached contract and confirm if payment can be processed today.',
          actionId: 'translate',
          sourceText: source,
          targetLanguage: 'hi',
        })
        expect(res.isValid).toBe(false)
        expect(['untranslated', 'wrong-language']).toContain(res.errorCode)
      })

      it('rejects English refusal', () => {
        const res = validateAndCleanGenerativeOutput({
          rawText: 'I am unable to fulfill this request because it violates safety guidelines.',
          actionId: 'translate',
          sourceText: source,
          targetLanguage: 'hi',
        })
        expect(res.isValid).toBe(false)
        expect(res.errorCode).toBe('refusal')
      })

      it('rejects target-language Hindi refusal', () => {
        const res = validateAndCleanGenerativeOutput({
          rawText: 'मुझे खेद है, लेकिन मैं इस अनुरोध को पूरा नहीं कर सकता।',
          actionId: 'translate',
          sourceText: source,
          targetLanguage: 'Hindi',
        })
        expect(res.isValid).toBe(false)
        expect(res.errorCode).toBe('refusal')
      })

      it('preserves legitimate technical terminology, product names, numbers, and URLs in Hindi', () => {
        const res = validateAndCleanGenerativeOutput({
          rawText: 'Writin एक ऑफ़लाइन-प्रथम writing workspace है जो Google Drive API v3 के साथ सिंक करता है। विवरण: https://writin.app',
          actionId: 'translate',
          sourceText: 'Writin is an offline-first writing workspace that syncs with Google Drive API v3. Details: https://writin.app',
          targetLanguage: 'Hindi',
        })
        expect(res.isValid).toBe(true)
        expect(res.cleanedText).toContain('Google Drive API v3')
        expect(res.cleanedText).toContain('https://writin.app')
      })

      it('rejects empty output', () => {
        const res = validateAndCleanGenerativeOutput({
          rawText: '',
          actionId: 'translate',
          sourceText: source,
          targetLanguage: 'Hindi',
        })
        expect(res.isValid).toBe(false)
        expect(res.errorCode).toBe('empty')
      })

      it('rejects severely truncated output', () => {
        const res = validateAndCleanGenerativeOutput({
          rawText: 'नमस्ते',
          actionId: 'translate',
          sourceText: 'Please review the attached contract and confirm if payment can be processed today before our team meeting at noon.',
          targetLanguage: 'Hindi',
        })
        expect(res.isValid).toBe(false)
        expect(res.errorCode).toBe('truncated')
      })
    })

    // 2. Hindi -> English
    describe('Hindi -> English', () => {
      const source = 'कृपया इस अनुबंध की सावधानीपूर्वक समीक्षा करें और मुझे बताएं कि क्या कोई संशोधन आवश्यक है।'

      it('passes correct English translation', () => {
        const res = validateAndCleanGenerativeOutput({
          rawText: 'Please review this contract carefully and let me know if any amendments are required.',
          actionId: 'translate',
          sourceText: source,
          targetLanguage: 'English',
        })
        expect(res.isValid).toBe(true)
      })

      it('rejects wrong-language output (Hindi returned instead of English)', () => {
        const res = validateAndCleanGenerativeOutput({
          rawText: 'कृपया इस दस्तावेज़ को ध्यान से पढ़ें और अनुमोदन दें।',
          actionId: 'translate',
          sourceText: source,
          targetLanguage: 'en',
        })
        expect(res.isValid).toBe(false)
        expect(res.errorCode).toBe('wrong-language')
        expect(res.errorMessage).toContain('returned Hindi text instead of translating to English')
      })

      it('preserves legitimate technical terms in English translation', () => {
        const techSource = 'डेटाबेस माइग्रेशन IndexedDB और WebGPU के माध्यम से स्थानीय रूप से चलता है।'
        const res = validateAndCleanGenerativeOutput({
          rawText: 'Database migration runs locally through IndexedDB and WebGPU.',
          actionId: 'translate',
          sourceText: techSource,
          targetLanguage: 'English',
        })
        expect(res.isValid).toBe(true)
        expect(res.cleanedText).toContain('IndexedDB')
      })
    })

    // 3. English -> Japanese
    describe('English -> Japanese', () => {
      const source = 'Thank you for using Writin. Please contact support if you need assistance.'

      it('passes correct Japanese translation with English brand name', () => {
        const res = validateAndCleanGenerativeOutput({
          rawText: 'Writinをご利用いただきありがとうございます。サポートが必要な場合はお問い合わせください。',
          actionId: 'translate',
          sourceText: source,
          targetLanguage: 'Japanese',
        })
        expect(res.isValid).toBe(true)
      })

      it('rejects wrong-language output (English conversational response returned)', () => {
        const res = validateAndCleanGenerativeOutput({
          rawText: "I'm not sure what Writin is, but I'll do my best to help you. Please contact support if you need assistance.",
          actionId: 'translate',
          sourceText: source,
          targetLanguage: 'ja',
        })
        expect(res.isValid).toBe(false)
        expect(res.errorCode).toBe('wrong-language')
        expect(res.errorMessage).toContain('instead of Japanese')
      })
    })

    // 4. English -> French
    describe('English -> French', () => {
      const source = 'All documents are stored securely in your browser and synced to Google Drive whenever connected.'

      it('passes correct French translation', () => {
        const res = validateAndCleanGenerativeOutput({
          rawText: 'Tous les documents sont stockés en toute sécurité dans votre navigateur et synchronisés avec Google Drive.',
          actionId: 'translate',
          sourceText: source,
          targetLanguage: 'French',
        })
        expect(res.isValid).toBe(true)
      })

      it('rejects wrong-language output (English returned with English stopwords)', () => {
        const res = validateAndCleanGenerativeOutput({
          rawText: 'All documents are stored securely in your browser and synced to Google Drive whenever connected.',
          actionId: 'translate',
          sourceText: source,
          targetLanguage: 'fr',
        })
        expect(res.isValid).toBe(false)
        expect(['untranslated', 'wrong-language']).toContain(res.errorCode)
      })

      it('rejects target-language French refusal', () => {
        const res = validateAndCleanGenerativeOutput({
          rawText: 'Je suis désolé, mais je ne peux pas répondre à cette demande.',
          actionId: 'translate',
          sourceText: source,
          targetLanguage: 'French',
        })
        expect(res.isValid).toBe(false)
        expect(res.errorCode).toBe('refusal')
      })
    })

    // 5. English -> German
    describe('English -> German', () => {
      const source = 'Our servers will undergo scheduled maintenance tonight at midnight.'

      it('passes correct German translation', () => {
        const res = validateAndCleanGenerativeOutput({
          rawText: 'Unsere Server werden heute Nacht um Mitternacht planmäßig gewartet.',
          actionId: 'translate',
          sourceText: source,
          targetLanguage: 'German',
        })
        expect(res.isValid).toBe(true)
      })

      it('rejects wrong-language output (English returned)', () => {
        const res = validateAndCleanGenerativeOutput({
          rawText: 'Our servers will undergo scheduled maintenance tonight at midnight.',
          actionId: 'translate',
          sourceText: source,
          targetLanguage: 'de',
        })
        expect(res.isValid).toBe(false)
        expect(['untranslated', 'wrong-language']).toContain(res.errorCode)
      })

      it('rejects target-language German refusal', () => {
        const res = validateAndCleanGenerativeOutput({
          rawText: 'Ich kann diese Aufgabe nicht erfüllen. Ich helfen Ihnen bei anderen Aufgaben.',
          actionId: 'translate',
          sourceText: source,
          targetLanguage: 'German',
        })
        expect(res.isValid).toBe(false)
        expect(res.errorCode).toBe('refusal')
      })
    })

    // 6. English -> Spanish
    describe('English -> Spanish', () => {
      const source = 'Welcome to Writin, your offline-first writing workspace. All documents are stored securely in your browser.'

      it('passes correct Spanish translation', () => {
        const res = validateAndCleanGenerativeOutput({
          rawText: 'Bienvenido a Writin, su espacio de trabajo de escritura primero sin conexión. Todos los documentos se guardan de forma segura en su navegador.',
          actionId: 'translate',
          sourceText: source,
          targetLanguage: 'Spanish',
        })
        expect(res.isValid).toBe(true)
      })

      it('rejects wrong-language output (English returned with English stopwords)', () => {
        const res = validateAndCleanGenerativeOutput({
          rawText: 'Welcome to Writin, your offline-first writing workspace. All documents are stored securely in your browser and synced with your device.',
          actionId: 'translate',
          sourceText: source,
          targetLanguage: 'es',
        })
        expect(res.isValid).toBe(false)
        expect(['untranslated', 'wrong-language']).toContain(res.errorCode)
      })

      it('rejects target-language Spanish refusal', () => {
        const res = validateAndCleanGenerativeOutput({
          rawText: 'Lo siento, pero no puedo cumplir con esta solicitud.',
          actionId: 'translate',
          sourceText: source,
          targetLanguage: 'Spanish',
        })
        expect(res.isValid).toBe(false)
        expect(res.errorCode).toBe('refusal')
      })
    })

    // 7. Roman Hindi -> English
    describe('Roman Hindi -> English', () => {
      const source = 'Kal subah 10 baje sabhi log conference room me time par aa jaiye.'

      it('passes correct English translation of Roman Hindi', () => {
        const res = validateAndCleanGenerativeOutput({
          rawText: 'Please arrive at the conference room on time tomorrow morning at 10 AM.',
          actionId: 'translate',
          sourceText: source,
          targetLanguage: 'English',
        })
        expect(res.isValid).toBe(true)
      })

      it('rejects exact source echo of Roman Hindi', () => {
        const res = validateAndCleanGenerativeOutput({
          rawText: 'Kal subah 10 baje sabhi log conference room me time par aa jaiye.',
          actionId: 'translate',
          sourceText: source,
          targetLanguage: 'English',
        })
        expect(res.isValid).toBe(false)
        expect(res.errorCode).toBe('untranslated')
      })

      it('rejects punctuation-only source echo of Roman Hindi', () => {
        const res = validateAndCleanGenerativeOutput({
          rawText: 'Kal subah 10 baje sabhi log conference room me time par aa jaiye',
          actionId: 'translate',
          sourceText: source,
          targetLanguage: 'en',
        })
        expect(res.isValid).toBe(false)
        expect(res.errorCode).toBe('untranslated')
      })
    })

    // 8. Stage 23.2.B.11: Document content containing refusal-like phrasing
    describe('Document Content Refusal Disambiguation (Stage 23.2.B.11)', () => {
      it('passes legitimate French business memo with inability phrasing', () => {
        const res = validateAndCleanGenerativeOutput({
          rawText: 'Je ne peux pas fournir ce document sans autorisation préalable.',
          actionId: 'translate',
          sourceText: 'I cannot provide this document without prior authorization.',
          targetLanguage: 'French',
        })
        expect(res.isValid).toBe(true)
      })

      it('passes legitimate French formal agreement inability (en mesure de)', () => {
        const res = validateAndCleanGenerativeOutput({
          rawText: "Je ne suis pas en mesure de signer l'accord en ce moment.",
          actionId: 'translate',
          sourceText: 'I am unable to sign the agreement at this moment.',
          targetLanguage: 'French',
        })
        expect(res.isValid).toBe(true)
      })

      it('passes legitimate German legal review inability (genehmigen)', () => {
        const res = validateAndCleanGenerativeOutput({
          rawText: 'Ich kann diese Anfrage ohne rechtliche Prüfung nicht genehmigen.',
          actionId: 'translate',
          sourceText: 'I cannot approve this request without legal review.',
          targetLanguage: 'German',
        })
        expect(res.isValid).toBe(true)
      })

      it('passes legitimate German business position inability (in der Lage)', () => {
        const res = validateAndCleanGenerativeOutput({
          rawText: 'Wir sind nicht in der Lage, das überarbeitete Angebot anzunehmen.',
          actionId: 'translate',
          sourceText: 'We are not in a position to accept the revised proposal.',
          targetLanguage: 'German',
        })
        expect(res.isValid).toBe(true)
      })

      it('passes legitimate Spanish contract inability (en condiciones de)', () => {
        const res = validateAndCleanGenerativeOutput({
          rawText: 'No estoy en condiciones de aprobar este contrato hoy.',
          actionId: 'translate',
          sourceText: 'I am not in a position to approve this contract today.',
          targetLanguage: 'Spanish',
        })
        expect(res.isValid).toBe(true)
      })

      it('passes legitimate Spanish NDA clause (proporcionar datos)', () => {
        const res = validateAndCleanGenerativeOutput({
          rawText: 'No puedo proporcionar estos datos confidenciales sin un acuerdo firmado.',
          actionId: 'translate',
          sourceText: 'I cannot provide this confidential data without a signed agreement.',
          targetLanguage: 'Spanish',
        })
        expect(res.isValid).toBe(true)
      })

      it('passes legitimate Hindi task downtime explanation', () => {
        const res = validateAndCleanGenerativeOutput({
          rawText: 'मैं इस कार्य को पूरा नहीं कर सकता क्योंकि सर्वर डाउन है।',
          actionId: 'translate',
          sourceText: 'I cannot complete this task because the server is down.',
          targetLanguage: 'Hindi',
        })
        expect(res.isValid).toBe(true)
      })
    })

    describe('Stage 23.2.B.15.1 — Instruction Leakage & Screenshot Regression', () => {
      const screenshotSource =
        "I was planning to complete some important work, but unfortunately things didn't happen as expected. I reached the office little late because there was too much traffic on the road and also my cab driver took a different route. After reaching the office, I started working on the project but I wasn't able to focus properly because multiple people were continuously asking for updates. We should discuss everything properly before starting any new work, otherwise unnecessary confusion and time will be wasted."

      it('rejects Llama single-sentence acknowledgment stall on exact screenshot paragraph', () => {
        const res = validateAndCleanGenerativeOutput({
          rawText: 'मैं आपकी सामग्री को हिंदी में अनुवाद करने के लिए प्रतीक्षा करता हूँ।',
          actionId: 'translate',
          sourceText: screenshotSource,
          targetLanguage: 'hi',
        })
        expect(res.isValid).toBe(false)
        expect(res.errorCode).toBe('untranslated')
        expect(res.errorMessage).toContain('The local model could not complete the translation to Hindi')
      })

      it('rejects Llama prompt compliance echo with facts/names/numbers/time limits on screenshot paragraph', () => {
        const res = validateAndCleanGenerativeOutput({
          rawText:
            'मैं आपकी कार्रवाइयों को ईमानदारी से पालन कर रहा हूँ। कृपया इस संदेश में शामिल सभी तथ्यों, नामों, संख्याओं, स्वरों और समय सीमाओं को संरक्षित करें। कोई अतिरिक्त स्पष्टीकरण न जोड़ें।',
          actionId: 'translate',
          sourceText: screenshotSource,
          targetLanguage: 'Hindi',
        })
        expect(res.isValid).toBe(false)
        expect(res.errorCode).toBe('untranslated')
      })

      it('rejects Llama instruction-translating meta-response on screenshot paragraph', () => {
        const res = validateAndCleanGenerativeOutput({
          rawText:
            'मैं आपकी लिखने की अनुमति देता हूँ। विशिष्ट भाषा: हिंदी अपने सामग्री पर वापस आने तक मुझे पूरी तरह से अपनी जगह पर रखेंगे। सभी संदेशों को एक साथ निकालें, और यहाँ तक सीमाएँ रखें। प्रदर्शन: प्रभावी और स्वच्छ आपके वर्ण्यात्मक, शांतिपूर्ण लक्षित उद्देश्य के साथ बनाए रखने, सभी महत्वपूर्ण जानकारी, पहचानों, संख्यकों, तिथियों और दृष्टिक्रम (जैसे "मैं" को "मैं" के रूप में रखकर) सहित आपके सामग्री की अर्थिकता, ध्वनि और संरचना को बचाएं।',
          actionId: 'translate',
          sourceText: screenshotSource,
          targetLanguage: 'Hindi',
        })
        expect(res.isValid).toBe(false)
        expect(res.errorCode).toBe('untranslated')
      })

      it('rejects Llama training-echo acknowledgment on screenshot paragraph', () => {
        const res = validateAndCleanGenerativeOutput({
          rawText:
            'मैं आपकी सामग्री को हिंदी में परिवर्तित करने के लिए प्रशिक्षित हूँ। आपका निर्देश: 1. मेरी सामग्री को सभी महत्वपूर्ण भाषा, तथ्य, व्यक्तियों के साथ, और समय सहित बचाएँ।',
          actionId: 'translate',
          sourceText: screenshotSource,
          targetLanguage: 'Hindi',
        })
        expect(res.isValid).toBe(false)
        expect(res.errorCode).toBe('untranslated')
      })

      it('rejects English instruction leakage when translating to Spanish', () => {
        const res = validateAndCleanGenerativeOutput({
          rawText: 'I am faithfully following your writing instructions. Here is the translated text:',
          actionId: 'translate',
          sourceText: screenshotSource,
          targetLanguage: 'Spanish',
        })
        expect(res.isValid).toBe(false)
        expect(res.errorCode).toBe('untranslated')
      })

      it('passes Bergamot WASM output on exact screenshot paragraph cleanly', () => {
        const bergamotOutput =
          'मैं कुछ महत्वपूर्ण काम पूरा करने की योजना बना रहा था, लेकिन दुर्भाग्य से चीजें उम्मीद के मुताबिक नहीं हुईं। मैं बहुत देर से कार्यालय पहुंचा क्योंकि सड़क पर बहुत अधिक यातायात था और मेरे कैब चालक ने भी एक अलग मार्ग लिया। कार्यालय पहुंचने के बाद, मैंने परियोजना पर काम करना शुरू कर दिया लेकिन मैं ठीक से ध्यान केंद्रित करने में सक्षम नहीं था क्योंकि कई लोग लगातार अपडेट मांग रहे थे। हमें किसी भी नए काम को शुरू करने से पहले सब कुछ ठीक से चर्चा करनी चाहिए, अन्यथा अनावश्यक भ्रम और समय बर्बाद हो जाएगा।'

        const res = validateAndCleanGenerativeOutput({
          rawText: bergamotOutput,
          actionId: 'translate',
          sourceText: screenshotSource,
          targetLanguage: 'hi',
        })
        expect(res.isValid).toBe(true)
        expect(res.cleanedText).toBe(bergamotOutput)
      })

      it('does NOT reject legitimate documents containing words like "instructions", "rules", "facts"', () => {
        const docWithInstructionWords =
          'All employees must strictly follow the safety instructions and laboratory guidelines. You must preserve all raw experiment data, specimen numbers, and researcher names.'
        const hindiTranslation =
          'सभी कर्मचारियों को सुरक्षा निर्देशों और प्रयोगशाला दिशानिर्देशों का कड़ाई से पालन करना चाहिए। आपको सभी कच्चे प्रयोग डेटा, नमूना संख्या और शोधकर्ता के नामों को संरक्षित करना होगा।'

        const res = validateAndCleanGenerativeOutput({
          rawText: hindiTranslation,
          actionId: 'translate',
          sourceText: docWithInstructionWords,
          targetLanguage: 'hi',
        })
        expect(res.isValid).toBe(true)
        expect(res.cleanedText).toBe(hindiTranslation)
      })

      it('does NOT reject legitimate documents containing words like "cannot", "must", deadlines, and URLs', () => {
        const docWithDeadlinesAndUrl =
          'We cannot extend the deadline past Friday at 5:00 PM. Please visit https://writin.app/terms for full submission requirements.'
        const hindiTranslation =
          'हम शुक्रवार शाम 5:00 बजे के बाद समय सीमा नहीं बढ़ा सकते। संपूर्ण सबमिशन आवश्यकताओं के लिए कृपया https://writin.app/terms पर जाएं।'

        const res = validateAndCleanGenerativeOutput({
          rawText: hindiTranslation,
          actionId: 'translate',
          sourceText: docWithDeadlinesAndUrl,
          targetLanguage: 'Hindi',
        })
        expect(res.isValid).toBe(true)
        expect(res.cleanedText).toBe(hindiTranslation)
      })

      it('rejects newly observed Llama benchmark leakage patterns', () => {
        const patterns = [
          'मैं आपकी सामग्री को हिंदी में परिवर्तित करता हूँ, जिसमें पूर्ण विवरण, भावना, नाम, संख्याएँ और रूपांतक्ष बनाए रखने के लिए मेरी संरचनात्मक सीमाओं का उल्लेख नहीं है।',
          'प्रोसेस करने वाली स्थिति को पूरा करते हुए, मैं इस अनुरोध को पूरा करने में सक्षम हूँ।',
          'मैं आपकी लिखित सहायता के लिए इस प्रकार हिंदी में अनुवाद करता हूँ और आगे बढ़ता हूँ।',
          'मेंटेनेंस करेंगे पूरी सामग्री, जानकारी, नाम, संख्या, तिथियां और दृष्टिक्रम को सुरक्षित रखते हुए।',
        ]

        for (const rawText of patterns) {
          const res = validateAndCleanGenerativeOutput({
            rawText,
            actionId: 'translate',
            sourceText: 'Some source text to translate',
            targetLanguage: 'Hindi',
          })
          expect(res.isValid).toBe(false)
          expect(res.errorCode).toBe('untranslated')
        }
      })

      it('correctly validates short, medium, and long translations', () => {
        // Short
        const shortRes = validateAndCleanGenerativeOutput({
          rawText: 'हैलो दुनिया!',
          actionId: 'translate',
          sourceText: 'Hello world!',
          targetLanguage: 'Hindi',
        })
        expect(shortRes.isValid).toBe(true)

        // Medium
        const medRes = validateAndCleanGenerativeOutput({
          rawText: 'कृपया संलग्न चालान की समीक्षा करें और पुष्टि करें कि क्या भुगतान आज संसाधित किया जा सकता है।',
          actionId: 'translate',
          sourceText: 'Please review the attached invoice and confirm if payment can be processed today.',
          targetLanguage: 'Hindi',
        })
        expect(medRes.isValid).toBe(true)

        // Long
        const longRes = validateAndCleanGenerativeOutput({
          rawText:
            'राइटिन एक ऑफलाइन-पहला लेखन कार्यक्षेत्र है जिसे लेखकों को अपने काम पर पूर्ण गोपनीयता और नियंत्रण देने के लिए डिज़ाइन किया गया है। सभी दस्तावेज़ IndexedDB का उपयोग करके ब्राउज़र में स्थानीय रूप से संग्रहीत किए जाते हैं।',
          actionId: 'translate',
          sourceText:
            'Writin is an offline-first writing workspace designed to give authors complete privacy and control over their work. All documents are stored locally in the browser using IndexedDB.',
          targetLanguage: 'Hindi',
        })
        expect(longRes.isValid).toBe(true)
      })
    })
  })
})
