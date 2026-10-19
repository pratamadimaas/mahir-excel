import { Link } from 'react-router';
import { useI18n } from '../../i18n/I18n';
import { Wordmark } from './Header';

const CONTACT = (import.meta.env.VITE_CONTACT_URL as string | undefined)?.trim();

export function Footer() {
  const { t } = useI18n();
  return (
    <footer className="xl-footer">
      <div className="xl-page">
        <div className="row g-4">
          <div className="col-12 col-md-5">
            <Wordmark />
            <p className="mt-2 mb-2">{t('footer.tagline')}</p>
            <p className="xl-small mb-0">{t('footer.disclaimer')}</p>
          </div>
          <div className="col-6 col-md-2">
            <h2>{t('footer.learn')}</h2>
            <ul>
              <li>
                <Link to="/belajar">{t('footer.academy')}</Link>
              </li>
              <li>
                <Link to="/latihan">{t('footer.practice')}</Link>
              </li>
              <li>
                <Link to="/tantangan">{t('footer.challenge')}</Link>
              </li>
              <li>
                <Link to="/kemajuan">{t('footer.progress')}</Link>
              </li>
              <li>
                <Link to="/tes-penempatan">{t('footer.placement')}</Link>
              </li>
              <li>
                <Link to="/sprint">{t('footer.sprint')}</Link>
              </li>
            </ul>
          </div>
          <div className="col-6 col-md-2">
            <h2>{t('footer.resources')}</h2>
            <ul>
              <li>
                <Link to="/shortcut">{t('footer.shortcuts')}</Link>
              </li>
              <li>
                <Link to="/worksheet">{t('footer.worksheets')}</Link>
              </li>
            </ul>
          </div>
          <div className="col-12 col-md-3">
            <h2>{t('footer.info')}</h2>
            <ul>
              <li>
                <Link to="/tentang">{t('footer.about')}</Link>
              </li>
              <li>
                <Link to="/privasi">{t('footer.privacy')}</Link>
              </li>
              <li>
                <Link to="/syarat">{t('footer.terms')}</Link>
              </li>
              {CONTACT && (
                <li>
                  <a href={CONTACT} rel="noopener noreferrer">
                    {t('footer.contact')}
                  </a>
                </li>
              )}
              <li>
                <Link to="/masuk">{t('footer.auth')}</Link>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
}
