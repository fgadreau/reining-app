import React from "react";
import { useTranslation } from "../features/i18n/I18nProvider";

// Replaces the existing ShowScore text only when the sponsor rail is empty.
// Video and populated sponsor slots keep all their available space.
export default function TvSignature() {
  const { language } = useTranslation();
  return <img className="tv-showscore-signature" src={`/branding/showscore-${language === 'en' ? 'logo-en' : 'logo'}.svg`}
    alt={language === 'en' ? 'ShowScore — By HSP' : 'ShowScore — Par HSP'} width="1620" height="450" />;
}
