import { Link } from "react-router-dom";
import Header from "../../components/Header";
import styles from "./styles.module.scss";

export default function HomeNoAuth() {
  return (
    <>
      <Header />
      <div className={styles.firstContent}>
        <div className={styles.title}>
          <p>
            Take charge of <br /> your money and <br />
            live your{" "}
          </p>
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
      
    </>
  );
}
