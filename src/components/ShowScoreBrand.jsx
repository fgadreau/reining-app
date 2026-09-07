import React from 'react';
import { useTranslation } from '../features/i18n/I18nProvider';

export default function ShowScoreBrand({ compact = false, hero = false }) {
  const { language } = useTranslation();
  const english = language === 'en';
  const label = english ? 'By HSP' : 'Par HSP';
  return (
    <span className={`showscore-brand${hero ? ' showscore-brand--hero' : ''}${compact ? ' showscore-brand--compact' : ''}`}>
      <img src={`/branding/showscore-${compact ? 'symbole' : english ? 'logo-en' : 'logo'}.svg`} alt={compact ? 'ShowScore' : `ShowScore — ${label}`} width={compact ? 1000 : 1620} height={compact ? 1000 : 450} />
      {compact && <span className="showscore-brand-copy"><small>{label}</small></span>}
    </span>
  );
}
