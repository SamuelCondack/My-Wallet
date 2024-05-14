import styles from "./styles.module.scss";

export default function Register() {
  return (
    <>
      <div>
        <p>Register Now!</p>
        <form action="">
          <label htmlFor="name">Name</label>
          <input type="text" id="name" />

          <label htmlFor="lastName">Last Name</label>
          <input type="text" id="lastName" />

          <label htmlFor="email">Email</label>
          <input type="email" id="email" />

          <label htmlFor="password">Password</label>
          <input type="password" id="password" />

          <label htmlFor="confirmPassword">Confirm Password</label>
          <input type="password" id="confirmPassword" />

        </form>
      </div>
    </>
  );
}
