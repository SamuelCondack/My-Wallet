import { Link } from "react-router-dom";
import Header from "../../components/Header";
import styles from "./styles.module.scss";
import upRight from "../../assets/upRight.png"
import pink from "../../assets/pink.png"

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
          <p>Take notes</p>
        <div className={styles.notes}>
          <div>
            <div className={styles.arrowDiv}>
              <img className={styles.upRightArrow} src={pink} alt="" />
              <p>+3.1%</p>
            </div>
            <p>Outcome</p>
          </div>
        </div>
      </div>
    </>
  );
}
