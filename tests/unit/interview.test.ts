import { describe, expect, it } from 'vitest';
import { localAnalyze, validateHeroName, matchKeyword, normalizeHe } from '../../src/game/analyze';
import { startInterview, answerInterview, type Turn } from '../../src/game/interview';
import { normalizePhone, isWeakPin, formatPhone } from '../../src/game/phone';

describe('localAnalyze', () => {
  it('detects realms in natural Hebrew with prefixes', () => {
    expect(localAnalyze('אני רוצה לחזור להתאמן ולישון טוב יותר').realms).toContain('body');
    expect(localAnalyze('לקרוא יותר ספרים וללמוד אנגלית').realms[0]).toBe('mind');
    expect(localAnalyze('למצוא עבודה חדשה ולחסוך כסף').realms[0]).toBe('career');
    expect(localAnalyze('להיות יותר עם המשפחה והחברים').realms[0]).toBe('relationships');
    expect(localAnalyze('פחות טלפון, יותר שגרה מסודרת').realms).toContain('discipline');
    expect(localAnalyze('לטייל יותר ולנסות דברים חדשים').realms[0]).toBe('adventure');
  });
  it('does not match short stems inside other words', () => {
    expect(matchKeyword('הרבה דברים', 'הר')).toBe(false);
    expect(matchKeyword('אחרי העבודה', 'אח')).toBe(false);
    expect(matchKeyword('עם החברים', 'חבר')).toBe(true);
  });
  it('detects struggles', () => {
    expect(localAnalyze('אין לי כוח בערב').struggles).toContain('energy');
    expect(localAnalyze('אני כל הזמן דוחה דברים למחר').struggles[0]).toBe('procrastination');
    expect(localAnalyze('נתקע בטיקטוק ובטלפון').struggles[0]).toBe('focus');
    expect(localAnalyze('מתחיל ומוותר אחרי שבוע').struggles).toContain('consistency');
    expect(localAnalyze('פוחד להיכשל').struggles[0]).toBe('fear');
  });
  it('picks up time and hints', () => {
    expect(localAnalyze('יש לי בערך 15 דקות ביום').minutes).toBe(20);
    expect(localAnalyze('שעה ביום').minutes).toBe(40);
    expect(localAnalyze('רוצה לישון טוב').hints).toContain('sleep');
  });
  it('normalises niqqud and final letters', () => {
    expect(normalizeHe('שָׁלוֹם!')).toBe('שלומ');
  });
});

describe('validateHeroName', () => {
  it('accepts names and nicknames', () => {
    for (const n of ['נועה', 'אלון כהן', 'Neo', 'הנשר', "ג'וני", 'בר-לב']) expect(validateHeroName(n).ok, n).toBe(true);
  });
  it('rejects sentences and answers to other questions', () => {
    for (const n of ['אין לי כוח', 'לא יודע', 'אני רוצה לשפר כושר', 'קשה לי', 'זה', 'כן', 'עייף']) {
      expect(validateHeroName(n).ok, n).toBe(false);
    }
  });
  it('rejects junk', () => {
    expect(validateHeroName('').ok).toBe(false);
    expect(validateHeroName('א').ok).toBe(false);
    expect(validateHeroName('a'.repeat(21)).ok).toBe(false);
    expect(validateHeroName('<script>').ok).toBe(false);
    expect(validateHeroName('נועה 123').ok).toBe(false);
    expect(validateHeroName('א ב ג ד').ok).toBe(false);
  });
});

describe('interview', () => {
  const run = (answers: { text?: string; chips?: string[] }[], account = 'דנה') => {
    let t: Turn = startInterview(account);
    const all: Turn[] = [t];
    for (const a of answers) {
      t = answerInterview(t.iv, a, account);
      all.push(t);
    }
    return { t, all };
  };

  it('full happy path', () => {
    const { t } = run([
      { text: 'נועה' },
      { text: 'לחזור לכושר ולקרוא יותר' },
      { text: 'אין לי כוח בערב ואני נתקעת בטלפון' },
      { chips: ['10'] },
    ]);
    expect(t.iv.step).toBe('done');
    expect(t.iv.name).toBe('נועה');
    expect(t.iv.focus).toEqual(expect.arrayContaining(['body', 'mind']));
    expect(t.iv.struggles).toEqual(expect.arrayContaining(['energy', 'focus']));
    expect(t.iv.minutes).toBe(10);
    const text = t.msgs.map((m) => m.text).join(' ');
    expect(text).toContain('נועה');
    expect(text).toContain('עייפון');
  });
  it('a sentence is never taken as the name', () => {
    const { t, all } = run([{ text: 'אין לי כוח' }, { text: 'לא יודע' }, { text: 'אלון' }]);
    expect(all[1]!.iv.step).toBe('name');
    expect(all[1]!.iv.name).toBe('');
    expect(all[2]!.iv.step).toBe('name');
    expect(t.iv.name).toBe('אלון');
    expect(t.iv.step).toBe('goal');
  });
  it('later answers never change the name', () => {
    const { t } = run([{ text: 'אלון' }, { text: 'שינה' }, { text: 'אין לי כוח' }, { chips: ['20'] }]);
    expect(t.iv.name).toBe('אלון');
  });
  it('account name chip works', () => {
    const { t } = run([{ chips: ['account'] }]);
    expect(t.iv.name).toBe('דנה');
  });
  it('asks a follow-up when it cannot tell the realm or struggle', () => {
    const { all } = run([{ text: 'אלון' }, { text: 'בלה בלה' }, { chips: ['career'] }, { text: 'קשה להסביר' }, { chips: ['fear'] }, { chips: ['40'] }]);
    expect(all[2]!.iv.step).toBe('goalRealm');
    expect(all[3]!.iv.focus).toEqual(['career']);
    expect(all[4]!.iv.step).toBe('blockPick');
    expect(all[5]!.iv.struggles).toEqual(['fear']);
    expect(all[6]!.iv.step).toBe('done');
    expect(all[6]!.iv.minutes).toBe(40);
  });
});

describe('phone + pin', () => {
  it('normalises Israeli mobiles like the server', () => {
    expect(normalizePhone('050-123-4567')).toBe('972501234567');
    expect(normalizePhone('+972 50 123 4567')).toBe('972501234567');
    expect(normalizePhone('00972501234567')).toBe('972501234567');
    expect(normalizePhone('03-1234567')).toBe(null);
    expect(normalizePhone('12')).toBe(null);
    expect(formatPhone('972501234567')).toBe('050-123-4567');
  });
  it('flags weak pins', () => {
    expect(isWeakPin('1111')).toBe(true);
    expect(isWeakPin('1234')).toBe(true);
    expect(isWeakPin('4826')).toBe(false);
  });
});
