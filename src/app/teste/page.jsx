"use client";
import axios from "axios";
import React, { useState, useEffect } from "react";

export default function Teste() {
  const [responseData, setResponseData] = useState(null);

  // useEffect(() => {
  //   async function fetchData() {
  //     try {
  //       const response = await axios.get(
  //         "https://8572.meu-cloud.com/w2b/api/Ecommerce/Dpg/ProdsVideoContador/?token=UjNKMWNHOUVVRWZDcHlYQ3B6STVPVGt4TlRBek5EQXdNelV3d3FjbHdxY3dlREF5TURBd01EQXdPRFpFTnpJek1qQTNNakF5TnpSRFF6UTFORVV5TVRnNVEwWXlSa0kyTWprek16WXdRekF6UVRFM1JVTkVPVGhHTlRWQk9FTkRNMFkzUlRjMU1VUkZNRU5DT1RNd04wWXlSRGcxUlVGRlFUZEJPRVUzTWtVNE9EQXdNVGRHT0RnM3dxY2x3cWN6TURQQ3B5WENwMGx6UVdSdGFXNXBjM1J5WVdSdmNzS25KY0tuTURBd01EQXdNREF0TURBd01DMHdNREF3TFRBd01EQXRNREF3TURBd01EQXdNREF3d3FjbHdxY3dNREF3TURBd01DMHdNREF3TFRBd01EQXRNREF3TUMwd01EQXdNREF3TURBd01EQT0=&document=96534474000192&table=3001"
  //       );
  //       setResponseData(response.data);
  //     } catch (error) {
  //       console.error("Error fetching data:", error);
  //     }
  //   }

  //   fetchData();
  // }, []);

  useEffect(() => {
    const docClienteRedeIdeia = "96534474000192";
    const tblClienteRedeIdeia = "3001";
    const token =
      "UjNKMWNHOUVVRWZDcHlYQ3B6STVPVGt4TlRBek5EQXdNelV3d3FjbHdxY3dlREF5TURBd01EQXdPRFpFTnpJek1qQTNNakF5TnpSRFF6UTFORVV5TVRnNVEwWXlSa0kyTWprek16WXdRekF6UVRFM1JVTkVPVGhHTlRWQk9FTkRNMFkzUlRjMU1VUkZNRU5DT1RNd04wWXlSRGcxUlVGRlFUZEJPRVUzTWtVNE9EQXdNVGRHT0RnM3dxY2x3cWN6TURQQ3B5WENwMGx6UVdSdGFXNXBjM1J5WVdSdmNzS25KY0tuTURBd01EQXdNREF0TURBd01DMHdNREF3TFRBd01EQXRNREF3TURBd01EQXdNREF3d3FjbHdxY3dNREF3TURBd01DMHdNREF3TFRBd01EQXRNREF3TUMwd01EQXdNREF3TURBd01EQT0=";
    async function getValorCertifcadoRedeIdeia() {
      try {
        const response = await fetch(
          `https://8572.meu-cloud.com/w2b/api/Ecommerce/Dpg/ProdsVideoContador/?token=${token}&document=${docClienteRedeIdeia}&table=${tblClienteRedeIdeia}`,
          {
            method: "GET",
          }
        );

        if (response.ok) {
          const data = await response.json();
          document.getElementById("certificadoCPF").innerHTML =
            data.Data[0].certificado.price.toFixed(2).replace(".", ",");
          document.getElementById("certificadoCNPJ").innerHTML =
            data.Data[1].certificado.price.toFixed(2).replace(".", ",");
        } else {
          console.error("Erro ao obter os valores do certificado");
        }
      } catch (error) {
        console.error("Erro na requisição:", error);
      }
    }
    getValorCertifcadoRedeIdeia();
  }, []);

  return (
    <div className="text-light p-5">
      <h1>Resposta da requisição:</h1>
      {responseData && <pre>{JSON.stringify(responseData, null, 2)}</pre>}
    </div>
  );
}
