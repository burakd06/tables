const express = require('express');
const path = require('path');
const { Client } = require('pg');
const dbConfig = require('./config');

const app = express();
const PORT = 3000;

// postgreSQL istemcisi oluştur
const client = new Client(dbConfig);
client.connect();


const axios = require('axios');
const https = require('https');

const agent = new https.Agent({  
  rejectUnauthorized: false // https doğrulamasını iptal etmek için
});
let data = JSON.stringify({});


function upddatabase() {axios.post('https://efatura.etrsoft.com/fmi/data/v1/databases/testdb/sessions',data, { httpsAgent: agent,  
    headers:  { 
    'Content-Type': 'application/json', 
    'Authorization': 'Basic YXBpdGVzdDp0ZXN0MTIz'
  } })
.then((response) => {

    let data2 = {
      "fieldData": {},
      "script": "getData"
    };
    
    let url = 'https://efatura.etrsoft.com/fmi/data/v1/databases/testdb/layouts/testdb/records/1';
    
    let headers = {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + response.data.response.token
    };
    
    // PATCH isteği gönderme
    axios.patch(url, data2, { headers: headers, httpsAgent : agent })
      .then((response) => {
      
        
        try {
            const jsonData = JSON.parse(response.data.response.scriptResult) ;
    

            for (var item of jsonData) {
               console.log(item) 
               if (!item.hesap_kodu) {
                    console.error('Eksik veya geçersiz hesap_kodu değeri bulundu:', item);
                    continue;
                } 
                
                 client.query(`
                   INSERT INTO hesaplar (
                        id, hesap_kodu, hesap_adi, tipi, ust_hesap_id, borc, alacak,
                        borc_sistem, alacak_sistem, borc_doviz, alacak_doviz,
                        borc_islem_doviz, alacak_islem_doviz, birim_adi, bakiye_sekli, aktif, dovizkod
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
                `, [


                    item.id || 0, item.hesap_kodu || null, item.hesap_adi || null, item.tipi || null, item.ust_hesap_id || 0, item.borc || 0, item.alacak || 0,
                    item.borc_sistem || 0, item.alacak_sistem || 0, item.borc_doviz || 0, item.alacak_doviz || 0,
                    item.borc_islem_doviz || 0, item.alacak_islem_doviz || 0 , item.birim_adi || null, item.bakiye_sekli || 0, item.aktif || 0, item.dovizkod || 0
                ]); 
            } 
     
            console.log('Veriler başarıyla PostgreSQL tablosuna aktarıldı.');
    
        } catch (parseError) {
            console.error('JSON parse işlemi sırasında bir hata oluştu:', parseError);
        } finally {
            // postgreSQL clientini kapat
        }
    })
      .catch((error) => {
        console.log(error);
      });
    })
.catch((error) => {
  console.log(error);
});

}
// milisaniye olarak çalışır kontrol için 1 dakikalık ayarladım 10 dakika için "1" yerine "10" yazılması yeterlidir
const interval = 1* 60 * 1000;

setInterval(upddatabase, interval);

// ilk çağrıyı hemen yapmak için setimmediate kullanıyoruz
setImmediate(upddatabase);

// JSON ve URL-encoded verileri işlemek için middleware ekleyin yani request ve response için gerekli
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// public klasörünü statik olarak kullan
app.use(express.static(path.join(__dirname, 'public')));

// giriş için POST isteği
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).send('Kullanıcı adı ve şifre gereklidir.');
    }

    try {
        // Veritabanında kullanıcıyı doğrula users tablom
        const result = await client.query('SELECT * FROM users WHERE username = $1 AND password = $2', [username, password]);

        if (result.rows.length > 0) {
            res.json({ message: 'Giriş başarılı',success : true });
        } else {
            res.json({ message: 'Geçersiz kullanıcı adı veya şifre',success : false });

        }
    } catch (err) {
        console.error('Giriş işlemi sırasında bir hata oluştu:', err);
        res.status(500).send('Sunucu hatası');
    }
});
app.get('/api/data', async (req, res) => {
    try {
        const result = await client.query('SELECT * FROM hesaplar ORDER BY id DESC');
        res.json(result.rows);
    } catch (err) {
        console.error('Veriler alınırken bir hata oluştu:', err);
        res.status(500).send('Sunucu hatası');
    }
});
// Sunucuyu başlat
app.listen(PORT, () => {
    console.log(`Sunucu http://localhost:${PORT} adresinde çalışıyor.`);
});
