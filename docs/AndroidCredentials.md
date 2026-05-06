dell@dell-H310M-M-2-2-0:~/flutter_app/main/ezo$ keytool -genkey -v -keystore ~/my-release-key.jks \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -alias my-key-alias
Enter keystore password:  
Re-enter new password: 
What is your first and last name?
  [Unknown]:  Chandan Pratap
What is the name of your organizational unit?
  [Unknown]:  Aeropack
What is the name of your organization?
  [Unknown]:  Aeropack Pvt Ltd
What is the name of your City or Locality?
  [Unknown]:  Delhi
What is the name of your State or Province?
  [Unknown]:  New Delhi
What is the two-letter country code for this unit?
  [Unknown]:  91
Is CN=Chandan Pratap, OU=Aeropack, O=Aeropack Pvt Ltd, L=Delhi, ST=New Delhi, C=91 correct?
  [no]:  Yes

Generating 2,048 bit RSA key pair and self-signed certificate (SHA256withRSA) with a validity of 10,000 days
        for: CN=Chandan Pratap, OU=Aeropack, O=Aeropack Pvt Ltd, L=Delhi, ST=New Delhi, C=91
[Storing /home/dell/my-release-key.jks]