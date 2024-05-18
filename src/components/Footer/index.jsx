 import styles from './styles.module.scss'

 const date = new Date()

export default function Footer() {
  return (
    <>
      <div className={styles.footerContainer}>
        <div className={styles.footer}>
          <p>&copy; Copyright {date.getFullYear()}. Made by <a href="https://samuelcondack.netlify.app/" target='_blank'>Samuel Condack</a></p>
        </div>
      </div>
    </>
  );
};
