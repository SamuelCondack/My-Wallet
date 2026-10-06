 import styles from './styles.module.scss'

import { useT } from '../../i18n/useT'

const date = new Date()

export default function Footer() {
  const t = useT()
  return (
    <>
      <div className={styles.footerContainer}>
        <div className={styles.footer}>
          <p>{t('landing.footer.copyright', { year: date.getFullYear() })} {t('landing.footer.madeBy')} <a href="https://samuelcondack.netlify.app/" target='_blank' rel="noreferrer">Samuel Condack</a></p>
        </div>
      </div>
    </>
  );
}
