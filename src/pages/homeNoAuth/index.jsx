import { Link } from "react-router-dom";
import Header from "../../components/Header";
import styles from "./styles.module.scss";
import outcomeImg from "../../assets/outcomePinkImg.png";

export default function HomeNoAuth() {
  return (
    <>
      <Header />
      <div className={styles.firstContent}>
        <div className={styles.title}>
          <h1>
            Take charge of <br /> your money and <br />
            live your{" "}
          </h1>
        </div>
        <div className={styles.subTitle}>
          <p>
            Embark on a financial journey towards a life filled with freedom,
            security, and endless possibilities. Take control of your finance
            and watch your life flourish
          </p>
          <Link className={styles.buttonLink} to="/">
            <button className={styles.registerBtn}>Try it now!</button>
          </Link>
        </div>
      </div>
      <div className={styles.secondContent}>
        <h1>Your everyday finance control app</h1>
        <div className={styles.firstLine}>
          <div className={styles.notesDiv}>
            <p>Take notes of your</p>
            <div className={styles.notes}>
              <div className={styles.outcome}>
                <div className={styles.arrowDiv}>
                  <img
                    className={styles.upRightArrow}
                    src={outcomeImg}
                    alt=""
                  />
                  <p className={styles.percentage}>+3.1%</p>
                </div>
                <p className={styles.outcomeParagraph}>Outcome</p>
                <p
                  className={`${styles.outcomeParagraph} ${styles.outcomePrice}`}
                >
                  $1.347.00
                </p>
              </div>
            </div>
          </div>
          <div className={styles.limitsDiv}>
            <p>Define your spending limits</p>
            <div className={styles.spendingLimitsItem}>
              <p>Spending Limits</p>
              <div className={styles.spendingLimitsOneLine}>
                <p className={styles.spendingLimitsPrice}>$1.347.00</p>
                <p className={styles.percentage}>+3.1%</p>
              </div>
              <div className={styles.limitsColor}>
                <div className={styles.purpleLimit}></div>
                <div className={styles.cyanLimit}></div>
                <div className={styles.pinkLimit}></div>
                <div className={styles.lightPurpleLimit}></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
